# @funbox/api-validator

## Описание

**api-validator** — это средство для проверки соответствия ответа от сервера документации APIB.

## Извлечение JSON-схем API в проекте

1. Добавить в зависимости проекта `@funbox/api-validator`;
2. Добавить в `package.json` проекта поле `doc` вида:
    ```
    "doc": {
      "repo": "git@github.com:your-username/your-apib-repository.git",
      "branch": "master",
      "file": "doc.apib"
    }
    ```
    где:
    - `repo` — адрес репозитория (обязательное поле);
    - `branch` — название ветки (обязательное поле);
    - `file` — название файла внутри репозитория (необязательное поле, по умолчанию `doc.apib`).
3. Добавить в `scripts` в `package.json` проекта команду:
    ```
    "update-schemas": "update-schemas"
    ```
4. Запустить обновление схем командой `npm run update-schemas`.
5. Команда сохранит в папке проекта файлы:
- `src/api-schemas/schemas.json` (содержит схемы);
- `src/api-schemas/doc-version.txt` (содержит ID коммита, использованного при создании схем). 

## Проверка ответов сервера в React-проектах

```javascript
import axios from 'axios';
import settings from 'app/app.settings';
import schemas from 'api-schemas/schemas';
import { validateResponse, validationStatus } from '@funbox/api-validator/validate-response';

axios.interceptors.response.use(response => {
  const result = validateResponse({
    method: response.config.method,
    url: response.config.url,
    data: response.data,
    schemas,
    basePath: settings.apiBase,
  });

  switch (result.status) {
    case validationStatus.invalid: {
      console.log(`Ошибка валидации ${response.config.method} ${response.config.url}`);
      console.log(result);
      return Promise.reject();
    }

    case validationStatus.schemaNotFound: {
      console.log(`Не найдена схема ${response.config.method} ${response.config.url}.`);
      return Promise.reject();
    }
  }

  return response;
});
```

## Проверка ответов сервера в Angular-проектах

```javascript
import schemas from 'api-schemas/schemas';
import { validateResponse, validationStatus } from '@funbox/api-validator/validate-response';

angular.module('app').config(['restfulProvider', 'settings', (restfulProvider, settings) => {
  restfulProvider.addInterceptor({
    postProcessResponse: (respWrapper) => {
      const response = respWrapper.response;

      const result = validateResponse({
        method: response.config.method,
        url: response.config.url,
        data: response.data,
        schemas,
        basePath: settings.apiBase,
      });

      switch (result.status) {
        case validationStatus.invalid: {
          console.log(`Ошибка валидации ${response.config.method} ${response.config.url}`);
          console.log(result);
          respWrapper.isSuccessful = false;
          break;
        }

        case validationStatus.schemaNotFound: {
          console.log(`Не найдена схема ${response.config.method} ${response.config.url}.`);
          respWrapper.isSuccessful = false;
          break;
        }
      }
    },
  });
}]);
```
