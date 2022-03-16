# @funboxteam/api-validator

**api-validator** is a frontend tool to validate server response against API Blueprint documentation.

## Extracting of JSON schemas in frontend projects

1. Add `@funboxteam/api-validator` to project dependencies.
2. Add inside of the `package.json` the next `doc` field:
    ```
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
3. Add the next script to the `package.json`:
    ```
    "update-schemas": "update-schemas"
    ```
4. Run `npm run update-schemas` to generate schemas or to update existing.
   This command will add required files in the project:
   - `src/api-schemas/schemas.json` (contains schemas);
   - `src/api-schemas/doc-version.txt` (contains the commit ID used to generate schemas).

## Example of validation in React projects

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

## Example of validation in Angular projects

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

## Example of validation for WebSocket connections

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
