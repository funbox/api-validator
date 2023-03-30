# @funboxteam/api-validator

**api-validator** — это средство для проверки ответа сервера на соответствие документации API Blueprint.

## Мотивация

Наличие человекочитаемой документации API — это хороший способ задать контракт между клиентской и серверной частями приложения.
Однако современные веб-приложения настолько сложны, что серверный ответ может легко содержать десятки полей и в каждое поле будут
вложены другие поля. Поэтому вполне возможна ситуация, когда бэкенд присылает ответ не по документации из-за бага или других причин.

Чтобы минимизировать количество ошибок в работе фронтэнда, связанное с некорректными ответами бекэнда, мы разработали инструмент
для валидации. Он выгружает JSON схемы из документации в формате API Blueprint и позволяет автоматически проверить соответствие
ответа бекэнда и документации на указанный запрос.

## Установка

```bash
npm install --save @funboxteam/api-validator
```

## Использование

### Извлечение JSON-схем API в проекте

Добавить в `package.json` проекта поле `doc` вида:
  ```json
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

Пакет предоставляет бинарный файл `update-schemas`, поэтому можно сгенерировать новые схемы или обновить существующие,
выполнив команду `update-schemas` в терминале.

Команда сохранит в папке проекта файлы:
   - `src/api-schemas/schemas.json` — содержит схемы;
   - `src/api-schemas/doc-version.txt` — содержит ID коммита, использованного при создании схем.

### Валидация ответа от сервера

Импортировать извлеченные схемы, добавленные в проект, и функцию валидации из утилиты:

```javascript
import { validateResponse } from '@funboxteam/api-validator';
import schemas from 'src/api-schemas/schemas';
```

Для получения результатов валидации вызвать функцию, в которую передать данные ответа и набор JSON схем:

```javascript
const responseInfo = {
  method: 'GET',
  url: '/api/auth',
  data: { status: 'ok' }
};

const validationResult = validateResponse({
  method: responseInfo.method,
  url: responseInfo.url,
  data: responseInfo.data,
  schemas,
});
```

## Примеры

### Проверка ответов сервера в React-проектах

```javascript
import axios from 'axios';
import settings from 'app/app.settings';
import schemas from 'api-schemas/schemas';
import { validateResponse, validationStatus } from '@funboxteam/api-validator';

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

### Проверка ответов сервера в Angular-проектах

```javascript
import schemas from 'api-schemas/schemas';
import { validateResponse, validationStatus } from '@funboxteam/api-validator';

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

### Проверка ответов сервера для WebSocket-соединения

В качестве примера используется JavaScript-клиент фреймворка
[Phoenix](https://hexdocs.pm/phoenix/js/):

```javascript
import schemas from 'api-schemas/schemas';
import { validateWebsocketResponse, validationStatus } from '@funboxteam/api-validator';
const { Socket } = require('phoenix');

const socket = new Socket('/adapter/v1', {});

socket.connect();

const channel = socket.channel('channel-topic');

channel.onMessage = (message, payload) => { // https://hexdocs.pm/phoenix/js/#channelonmessage
  const result = validateWebsocketResponse({
    messageTitle: message,
    channel: channel.topic,
    data: payload,
    schemas,
  });
  switch (result.status) {
    case validationStatus.valid:
      console.log(`Схема сообщения ${message} в канале ${channel.topic} найдена и валидна`);
      return payload;
    case validationStatus.invalid:
      console.warn(`Ошибка валидации сообщения ${message} в канале ${channel.topic}`);
      console.log(result);
      return payload;
    case validationStatus.schemaNotFound:
      console.warn(`Не найдена схема сообщения ${message} в канале ${channel.topic}`);
      return payload;
    default:
      return payload;
  }
};
```

[![Sponsored by FunBox](https://funbox.ru/badges/sponsored_by_funbox_centered.svg)](https://funbox.ru)
