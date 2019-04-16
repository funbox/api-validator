#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const rimraf = require('rimraf');
const generateSchemas = require('./generate-schemas');

function main() {
  const packageJsonPath = path.resolve('package.json');
  const packageJsonString = fs.readFileSync(packageJsonPath, { encoding: 'utf8' });
  const packageJson = JSON.parse(packageJsonString);
  const config = packageJson.doc || {};

  if (!config.repo || typeof config.repo !== 'string') {
    console.log('В поле "doc.repo" в package.json должна быть строка с адресом репозитория документации.');
    process.exit(1);
  }

  if (!config.branch || typeof config.branch !== 'string') {
    console.log('В поле "doc.branch" в package.json должна быть строка с названием ветки.');
    process.exit(1);
  }

  const remote = sanitizeParam(config.repo);
  const branch = sanitizeParam(config.branch);
  const file = (config.file && typeof config.file === 'string') ? sanitizeParam(config.file) : 'doc.apib';

  const basePath = path.resolve('src/api-schemas');
  if (!fs.existsSync(basePath)) {
    const srcPath = path.resolve('src');
    if (!fs.existsSync(srcPath)) {
      fs.mkdirSync(srcPath);
    }
    fs.mkdirSync(basePath);
  }

  const repoPath = path.resolve(basePath, 'doc_repo');
  if (fs.existsSync(repoPath)) {
    console.log(`Путь ${repoPath} уже занят! Удалите существующий файл/папку и попробуйте снова.`);
    process.exit(1);
  }

  console.log(`Получаем ID коммита из ${remote}, ветка ${branch}`);
  const commitIdResult = child_process.execSync(`git ls-remote "${remote}" "${branch}"`, { encoding: 'utf8' });
  const commitIdMatch = commitIdResult.match(/^\S+/);
  if (!commitIdMatch) {
    console.log(`В репозитории ${remote} не найдена ветка ${branch}`);
    process.exit(1);
  }
  const commitId = commitIdMatch[0];

  console.log(`Клонируем репозиторий документации в ${repoPath}`);
  child_process.execSync(`git clone -b "${branch}" -q --depth 1 "${remote}" ${repoPath}`);
  const doc = child_process.execSync(`git show ${commitId}:"${file}"`, { cwd: repoPath, encoding: 'utf8' });

  console.log(`Парсим ${file}`);

  const schemas = generateSchemas(path.resolve(repoPath, file));
  rimraf.sync(repoPath);

  const schemasPath = path.resolve(basePath, 'schemas.js');
  console.log(`Сохраняем схемы в ${schemasPath}`);
  fs.writeFileSync(schemasPath, `export default ${JSON.stringify(schemas, null, 2)};\n`);

  const versionPath = path.resolve(basePath, 'doc-version.txt');
  console.log(`Сохраняем ID коммита в ${versionPath}`);
  fs.writeFileSync(versionPath, commitId);
}

function sanitizeParam(param) {
  return param.replace(/"/g, '');
}

main();
