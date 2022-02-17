# @funboxteam/api-validator

**api-validator** is a frontend tool to validate server response against API Blueprint documentation.

[По-русски](./README.ru.md)

## Rationale

Having human-readable documentation is a good way to specify a contract between client and server parts of an application.
However, due to the complexity of modern web apps, a server response can contain dozens of fields and nested fields,
and it is easy for backend to not comply with the documentation because of a bug or any other reason.

To minimize the number of errors on the frontend side associated with incorrect backend responses, we developed a tool
for automatic validation. It extracts JSON schema from the API Blueprint documentation and allows to automatically check
correspondence between the backend response and the documentation for this request.

## Installation

```bash
npm install --save @funboxteam/api-blueprint
```

## Usage

### Extracting of JSON schemas in frontend projects

Add the next `doc` field in`package.json`:
  ```json
  "doc": {
    "repo": "git@github.com:your-username/your-apib-repository.git",
    "branch": "master",
    "file": "doc.apib"
  }
  ```
where:
  - `repo` — repository URL (required);
  - `branch` — target branch name (required);
  - `file` — file name in the repository (optional, default is `doc.apib`).
   
This package exposes a binary called `update-schemas`, therefore you can generate schemas or update existing schemas
by running `update-schemas` in a terminal.

This command will add required files in the project:
   - `src/api-schemas/schemas.json` — contains schemas;
   - `src/api-schemas/doc-version.txt` — contains the commit ID used to generate schemas.

### Server response validation

Import generated schemas from the project and the validation function from the package:

```javascript
import { validateResponse } from '@funboxteam/api-validator';
import schemas from 'src/api-schemas/schemas';
```

Call the validation function with response parameters and generated schemas to get validation result:

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

## Examples

### Example of validation in React projects

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
      console.log(`Validation error in ${response.config.method} ${response.config.url}`);
      console.log(result);
      return Promise.reject();
    }

    case validationStatus.schemaNotFound: {
      console.log(`No schema for ${response.config.method} ${response.config.url}.`);
      return Promise.reject();
    }
  }

  return response;
});
```

### Example of validation in Angular projects

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
          console.log(`Validation error in ${response.config.method} ${response.config.url}`);
          console.log(result);
          respWrapper.isSuccessful = false;
          break;
        }

        case validationStatus.schemaNotFound: {
          console.log(`No schema for ${response.config.method} ${response.config.url}.`);
          respWrapper.isSuccessful = false;
          break;
        }
      }
    },
  });
}]);
```

### Example of validation for WebSocket connections

This example is based on JavaScript client of the [Phoenix](https://hexdocs.pm/phoenix/js/) framework:

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
      console.log(`Schema of the message ${message} in the channel ${channel.topic} is valid`);
      return payload;
    case validationStatus.invalid:
      console.warn(`Error during validation of the message ${message} in the channel ${channel.topic}`);
      console.log(result);
      return payload;
    case validationStatus.schemaNotFound:
      console.warn(`Schema of the message ${message} in the channel ${channel.topic} not found`);
      return payload;
    default:
      return payload;
  }
};
```

[![Sponsored by FunBox](https://funbox.ru/badges/sponsored_by_funbox_centered.svg)](https://funbox.ru)
