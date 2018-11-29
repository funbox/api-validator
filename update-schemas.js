#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const protagonist = require('@funbox/protagonist');
const rimraf = require('rimraf');

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
  rimraf.sync(repoPath);

  console.log(`Парсим ${file}`);
  const ast = protagonist.parseSync(doc);
  const schemas = [];
  const resources = getResources(ast.content);

  resources.forEach((resource) => {
    resource.content.forEach((transition) => {
      if (!Array.isArray(transition.content)) {
        return;
      }

      transition.content.forEach((transaction) => {
        if (Array.isArray(transaction.content)) {
          const request = transaction.content.find((obj) => obj.element === 'httpRequest');
          const response = transaction.content.find((obj) => obj.element === 'httpResponse');
          const schemaElement = response.content.find((obj) => obj.attributes && obj.attributes.contentType === 'application/schema+json');
          if (schemaElement) {
            const method = request.attributes.method;
            const href = (transition.attributes && transition.attributes.href) ? transition.attributes.href : resource.attributes.href;
            const definition = JSON.parse(schemaElement.content);
            deleteDescriptions(definition);
            schemas.push({ method, href, definition });
          }
        }
      });
    });
  });

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

function getResources(content) {
  const resources = [];
  content.forEach(obj => {
    if (obj.element === 'resource') {
      resources.push(obj);
    } else if (Array.isArray(obj.content)) {
      Array.prototype.push.apply(resources, getResources(obj.content));
    }
  });
  return resources;
}

function deleteDescriptions(schema) {
  delete schema.description; // eslint-disable-line no-param-reassign
  switch (schema.type) {
    case 'object': {
      Object.keys(schema.properties).forEach(key => {
        deleteDescriptions(schema.properties[key]);
      });
      if (schema.oneOf) {
        schema.oneOf.forEach(subschema => {
          Object.keys(subschema.properties).forEach(key => {
            deleteDescriptions(subschema.properties[key]);
          });
        });
      }
      break;
    }
    case 'array': {
      if (schema.items) {
        if (Array.isArray(schema.items)) {
          schema.items.forEach(item => {
            deleteDescriptions(item);
          });
        } else {
          deleteDescriptions(schema.items);
        }
      }
      break;
    }
    // no default
  }
}

main();
