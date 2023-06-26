#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const child_process = require('node:child_process');
const { rimrafSync } = require('rimraf');
const generateSchemas = require('./generate-schemas');
const { logCrafterError } = require('./utils');

async function main() {
  const packageJsonPath = path.resolve('package.json');
  const packageJsonString = fs.readFileSync(packageJsonPath, { encoding: 'utf8' });
  const packageJson = JSON.parse(packageJsonString);
  const config = packageJson.doc || {};

  if (!config.repo || typeof config.repo !== 'string') {
    console.log('The "doc.repo" field in package.json should contain the URL of the documentation repository.');
    process.exit(1);
  }

  if (!config.branch || typeof config.branch !== 'string') {
    console.log('The "doc.repo" field in package.json should contain the branch name.');
    process.exit(1);
  }

  const remote = sanitizeParam(config.repo);
  const branch = sanitizeParam(config.branch);
  const file = (config.file && typeof config.file === 'string') ? sanitizeParam(config.file) : 'doc.apib';

  const basePath = path.resolve('src/api-schemas');
  let basePathCreated = false;
  if (!fs.existsSync(basePath)) {
    const srcPath = path.resolve('src');
    if (!fs.existsSync(srcPath)) {
      fs.mkdirSync(srcPath);
    }
    fs.mkdirSync(basePath);
    basePathCreated = true;
  }

  const repoPath = path.resolve(basePath, 'doc_repo');
  if (fs.existsSync(repoPath)) {
    console.log(`Path ${repoPath} already exists! Delete existing file/folder and try again.`);
    process.exit(1);
  }

  console.log(`Extracting commit ID from ${remote}, ${branch} branch`);
  const commitIdResult = child_process.execSync(`git ls-remote "${remote}" "${branch}"`, { encoding: 'utf8' });
  const commitIdMatch = commitIdResult.match(/^\S+/);
  if (!commitIdMatch) {
    console.log(`Branch ${branch} not found in the repository ${remote}`);
    process.exit(1);
  }
  const commitId = commitIdMatch[0];

  console.log(`Cloning the documentation repository into ${repoPath}`);
  child_process.execSync(`git clone -b "${branch}" -q --depth 1 "${remote}" ${repoPath}`);

  console.log(`Parsing of ${file}`);

  const filePath = path.resolve(repoPath, file);
  const { schemas, error } = await generateSchemas(filePath, true);

  if (error) {
    console.log(`Parsing error for ${file}, rollback changes.`);
    logCrafterError(filePath, error).then(() => {
      if (basePathCreated) {
        rimrafSync(basePath);
      }
      rimrafSync(repoPath);
    });
    return;
  }
  rimrafSync(repoPath);

  const schemasPath = path.resolve(basePath, 'schemas.js');
  console.log(`Save schemas into ${schemasPath}`);
  fs.writeFileSync(schemasPath, `export default ${JSON.stringify(schemas, null, 2)};\n`);

  const versionPath = path.resolve(basePath, 'doc-version.txt');
  console.log(`Save the commit ID into ${versionPath}`);
  fs.writeFileSync(versionPath, commitId);
}

function sanitizeParam(param) {
  return param.replace(/"/g, '');
}

main();
