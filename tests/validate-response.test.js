import { validationStatus, validateResponse, validateWebsocketResponse } from '../src/validate-response';

const assert = require('assert');
const generateSchemas = require('../src/generate-schemas');

describe('validateResponse', () => {
  describe('simple doc', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# GET /users
+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + result (string, required)
      `;
      schemas = await generateSchemas(doc);
    });

    it('handles valid response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/users',
        data: {
          status: 'ok',
          result: 'foo',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles invalid response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/users',
        data: {
          status: 'ok',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.invalid);
      assert.equal(result.checkedSchemas.length, 1);
      assert.equal(result.checkedSchemas[0].errors.length, 1);
      assert.equal(result.checkedSchemas[0].errors[0].message, 'Missing required property: result');
    });

    it('handles unknown response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/unknown',
        data: {
          status: 'ok',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });

    it('handles basePath in response URL', () => {
      const result = validateResponse({
        method: 'GET',
        url: 'http://example.com/users',
        data: {
          status: 'ok',
          result: 'foo',
        },
        schemas,
        basePath: 'http://example.com',
      });
      assert.equal(result.status, validationStatus.valid);
    });
  });

  describe('dynamic and static url segments', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# GET /books/{bookId}

+ Parameters
    + bookId (number, required)

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + bookIdField (number, required)

# GET /books/user

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + userField (number, required)
      `;
      schemas = await generateSchemas(doc);
    });

    it('validates /books/user', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/books/user',
        data: {
          status: 'ok',
          userField: 1,
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('validates /books/{bookId}', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/books/23',
        data: {
          status: 'ok',
          bookIdField: 1,
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('checks that bookId is a number', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/books/hello',
        data: {
          status: 'ok',
          bookIdField: 1,
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });
  });

  describe('dynamic and static query params', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# GET /foo

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + withoutParam (string, required)

# GET /foo{?param}

+ Parameters
    + param (string, required)

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + withDynamicParam (string, required)

# GET /foo?param=staticValue

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + withStaticParam (string, required)

# GET /foo?param=staticValue&param2

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + withTwoStaticParams (string, required)
      `;
      schemas = await generateSchemas(doc);
    });

    it('without param', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo',
        data: {
          status: 'ok',
          withoutParam: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('with dynamic param', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo?param=dynamicValue',
        data: {
          status: 'ok',
          withDynamicParam: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('with static param', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo?param=staticValue',
        data: {
          status: 'ok',
          withStaticParam: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('with two static params', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo?param=staticValue&param2',
        data: {
          status: 'ok',
          withTwoStaticParams: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('with two static params - different order of params', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo?param2&param=staticValue',
        data: {
          status: 'ok',
          withTwoStaticParams: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('with two static params and some unknown param', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo?param=staticValue&param2&unknown=x',
        data: {
          status: 'ok',
          withTwoStaticParams: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });
  });

  describe('should select schema that has the biggest number of matched required dynamic query parameters', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# GET /foo

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + noRequiredDynamicParams (string, required)

# GET /foo{?a,someOptionalDynamicParam}

+ Parameters
    + a (string, required)
    + someOptionalDynamicParam (string, optional)

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + oneRequiredDynamicParam (string, required)

# GET /foo{?a,b}

+ Parameters
    + a (string, required)
    + b (string, required)

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + twoRequiredDynamicParams (string, required)
      `;
      schemas = await generateSchemas(doc);
    });

    it('zero required dynamic params', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo',
        data: {
          status: 'ok',
          noRequiredDynamicParams: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('zero required dynamic params + some unknown params', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo?unknown1=x&unknown2=y',
        data: {
          status: 'ok',
          noRequiredDynamicParams: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('one required dynamic param', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo?a=1',
        data: {
          status: 'ok',
          oneRequiredDynamicParam: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('one required dynamic param + one optional dynamic param', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo?a=1&someOptionalDynamicParam',
        data: {
          status: 'ok',
          oneRequiredDynamicParam: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('two required dynamic params', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo?a=1&b=1',
        data: {
          status: 'ok',
          twoRequiredDynamicParams: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });
  });

  it('handles arrays in parameters', async () => {
    const doc = `
# My API

# Get arrays [GET /arrays/{?foo,bar}]
+ Parameters
    + foo: [1,2] (string, required) - array with two numbers
    + bar: [1,2] (string, required) - array with two numbers
+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
      `;
    const schemas = await generateSchemas(doc);
    const result = validateResponse({
      method: 'GET',
      url: '/arrays?foo[]=1&foo[]=2&bar[0]=3&bar[1]=4',
      data: {
        status: 'ok',
      },
      schemas,
    });
    assert.equal(result.status, validationStatus.valid);
  });

  describe('ampersand in query parameters', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# Get arrays [GET /foo/{varone}?path=test{&vartwo,varthree}]
+ Parameters
    + varone (number, required)
    + vartwo (string, required)
    + varthree (string, required)
+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
      `;
      schemas = await generateSchemas(doc);
    });

    it('valid', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo/2?path=test&vartwo=hello&varthree=world}',
        data: {
          status: 'ok',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('valid - different order of query params', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo/29?varthree=world&path=test&vartwo=hello}',
        data: {
          status: 'ok',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('schemaNotFound (no varthree)', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/foo/2?path=test&vartwo=hello}',
        data: {
          status: 'ok',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });
  });

  it('handles parameters without attributes', async () => {
    // Проверяем, что корректно обрабатывается параметр hello, у которого в Parameters не указаны атрибуты в скобках.
    const doc = `
# My API

# GET /foo{?hello}
+ Parameters
    + hello
+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
      `;
    const schemas = await generateSchemas(doc);
    const result = validateResponse({
      method: 'GET',
      url: '/foo?hello=world',
      data: {
        status: 'ok',
      },
      schemas,
    });
    assert.equal(result.status, validationStatus.valid);
  });

  describe('enums in parameters', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# GET /users/{order}
+ Parameters
    + order (enum, required)
        + Members
            + name
            + age
+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + type: order (required, fixed)

# GET /users/{filter}
+ Parameters
    + filter (enum, required)
        + Members
            + active
            + inactive
+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + type: filter (required, fixed)
      `;
      schemas = await generateSchemas(doc);
    });

    it('name', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/users/name',
        data: {
          status: 'ok',
          type: 'order',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('age', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/users/age',
        data: {
          status: 'ok',
          type: 'order',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('active', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/users/active',
        data: {
          status: 'ok',
          type: 'filter',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('inactive', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/users/inactive',
        data: {
          status: 'ok',
          type: 'filter',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('notMember', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/users/notMember',
        data: {
          status: 'ok',
          type: 'order',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });
  });

  describe('API method with multiple responses', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# GET /example

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + result (string, required)

+ Response 200 (application/json)
    + Attributes
        + status: internalError (required, fixed)

+ Response 200 (application/json)
    + Attributes(array[string])
      `;
      schemas = await generateSchemas(doc);
    });

    it('handles valid ok response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: {
          status: 'ok',
          result: 'hello',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles valid internalError response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: {
          status: 'internalError',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles valid array response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: ['hello', 'world'],
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles invalid ok response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: {
          status: 'ok',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.invalid);
      assert.equal(result.checkedSchemas.length, 3);
      assert.equal(result.checkedSchemas[0].errors.length, 1);
      assert.equal(result.checkedSchemas[0].errors[0].message, 'Missing required property: result');
      assert.equal(result.checkedSchemas[1].errors.length, 1);
      assert.equal(result.checkedSchemas[1].errors[0].message, 'No enum match for: "ok"');
      assert.equal(result.checkedSchemas[2].errors.length, 1);
      assert.equal(result.checkedSchemas[2].errors[0].message, 'Invalid type: object (expected array)');
    });

    it('handles invalid array response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: [1, false],
        schemas,
      });
      assert.equal(result.status, validationStatus.invalid);
      assert.equal(result.checkedSchemas.length, 3);
      assert.equal(result.checkedSchemas[0].errors.length, 1);
      assert.equal(result.checkedSchemas[0].errors[0].message, 'Invalid type: array (expected object)');
      assert.equal(result.checkedSchemas[1].errors.length, 1);
      assert.equal(result.checkedSchemas[1].errors[0].message, 'Invalid type: array (expected object)');
      assert.equal(result.checkedSchemas[2].errors.length, 2);
      assert.equal(result.checkedSchemas[2].errors[0].dataPath, '/0');
      assert.equal(result.checkedSchemas[2].errors[0].message, 'Invalid type: number (expected string)');
      assert.equal(result.checkedSchemas[2].errors[1].dataPath, '/1');
      assert.equal(result.checkedSchemas[2].errors[1].message, 'Invalid type: boolean (expected string)');
    });
  });

  describe('Status field', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# GET /example

+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + result (string, required)

+ Response 200 (application/json)
    + Attributes
        + status: internalError (required, fixed)
      `;
      schemas = await generateSchemas(doc);
    });

    it('handles valid ok response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: {
          status: 'ok',
          result: 'hello',
        },
        schemas,
        statusField: 'status',
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles valid internalError response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: {
          status: 'internalError',
        },
        schemas,
        statusField: 'status',
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles invalid ok response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: {
          status: 'ok',
        },
        schemas,
        statusField: 'status',
      });
      assert.equal(result.status, validationStatus.invalid);
      assert.equal(result.checkedSchemas.length, 1);
      assert.equal(result.checkedSchemas[0].errors.length, 1);
      assert.equal(result.checkedSchemas[0].errors[0].message, 'Missing required property: result');
    });

    it('handles response with unknown status', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: {
          status: 'unknown',
        },
        schemas,
        statusField: 'status',
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });

    it('handles response without status field', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: {
          result: 'hello',
        },
        schemas,
        statusField: 'status',
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });

    it('handles empty response', () => {
      const result = validateResponse({
        method: 'GET',
        url: '/example',
        data: '',
        schemas,
        statusField: 'status',
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });
  });
});

describe('validate WebSocket response', () => {
  describe('simple message without title', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# Group /adapter/v1

### Message

+ Attributes
    + msisdn (string, required)
    + redirect_url (string, required)
    
### Message

+ Attributes(string, required)
`;
      schemas = await generateSchemas(doc);
    });

    it('handles valid message with object payload', () => {
      const result = validateWebsocketResponse({
        data: {
          msisdn: '79250002233',
          redirect_url: 'http://localhost:8080',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles valid message with primitive payload', () => {
      const result = validateWebsocketResponse({
        data: 'hello world',
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles invalid message', () => {
      const result = validateWebsocketResponse({
        data: {
          msisdn: '79250002233',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });
  });

  describe('simple message with title', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# Group /adapter/v1

### Message authorization_finished

+ Attributes
    + msisdn (string, required)
    + redirect_url (string, required)
`;
      schemas = await generateSchemas(doc);
    });

    it('handles valid message', () => {
      const result = validateWebsocketResponse({
        messageTitle: 'authorization_finished',
        data: {
          msisdn: '79250002233',
          redirect_url: 'http://localhost:8080',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles invalid message', () => {
      const result = validateWebsocketResponse({
        messageTitle: 'authorization_finished',
        data: {
          msisdn: '79250002233',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.invalid);
      assert.equal(result.checkedSchemas.length, 1);
      assert.equal(result.checkedSchemas[0].errors.length, 1);
      assert.equal(result.checkedSchemas[0].errors[0].message, 'Missing required property: redirect_url');
    });

    it('handles unknown message', () => {
      const result = validateWebsocketResponse({
        messageTitle: 'unknown_message',
        data: {
          msisdn: '79250002233',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });
  });

  describe('simple message in subgroup', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# Group /adapter/v1

## SubGroup channel-1

### Message await_remote_interaction

+ Attributes
    + msisdn (string, required)
    + amr (array, required)
        + USSD_OK (string)
        + SMS_URL_OK (string)
`;
      schemas = await generateSchemas(doc);
    });

    it('handles valid message', () => {
      const result = validateWebsocketResponse({
        channel: 'channel-1',
        messageTitle: 'await_remote_interaction',
        data: {
          msisdn: '79250002233',
          amr: ['USSD_OK'],
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles invalid message', () => {
      const result = validateWebsocketResponse({
        channel: 'channel-1',
        messageTitle: 'await_remote_interaction',
        data: {
          msisdn: '79250002233',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.invalid);
      assert.equal(result.checkedSchemas.length, 1);
      assert.equal(result.checkedSchemas[0].errors.length, 1);
      assert.equal(result.checkedSchemas[0].errors[0].message, 'Missing required property: amr');
    });

    it('handles message with unknown message title', () => {
      const result = validateWebsocketResponse({
        channel: 'channel-1',
        messageTitle: 'unknown_message',
        data: {
          msisdn: '79250002233',
          amr: ['USSD_OK'],
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });

    it('handles message with unknown channel', () => {
      const result = validateWebsocketResponse({
        channel: 'channel-undefined',
        messageTitle: 'await_remote_interaction',
        data: {
          msisdn: '79250002233',
          amr: ['USSD_OK'],
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });
  });

  describe('subgroup with dynamic channel', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# Group /adapter/v1

## SubGroup {sessionToken}

### Message await_remote_interaction

+ Attributes
    + msisdn (string, required)
`;
      schemas = await generateSchemas(doc);
    });

    it('handles valid message', () => {
      const result = validateWebsocketResponse({
        channel: 'a6b29b64-8bed-4c29-956c-de2d45438cd9',
        messageTitle: 'await_remote_interaction',
        data: {
          msisdn: '79250002233',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });
  });

  describe('subgroup with one dynamic segment in channel', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# Group /adapter/v1

## SubGroup channel:{channelId}

### Message await_remote_interaction

+ Attributes
    + msisdn (string, required)
`;
      schemas = await generateSchemas(doc);
    });

    it('handles valid message', () => {
      const result = validateWebsocketResponse({
        channel: 'channel:1234',
        messageTitle: 'await_remote_interaction',
        data: {
          msisdn: '79250002233',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles invalid message', () => {
      const result = validateWebsocketResponse({
        channel: 'channel:1234',
        messageTitle: 'await_remote_interaction',
        data: {
          cliend_id: 'MegaFon',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.invalid);
      assert.equal(result.checkedSchemas.length, 1);
      assert.equal(result.checkedSchemas[0].errors.length, 1);
      assert.equal(result.checkedSchemas[0].errors[0].message, 'Missing required property: msisdn');
    });

    it('handles message with unknown channel', () => {
      const result = validateWebsocketResponse({
        channel: undefined,
        messageTitle: 'await_remote_interaction',
        data: {
          msisdn: '79250002233',
          amr: ['USSD_OK'],
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });
  });

  describe('subgroup with multiple dynamic segments in channel', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# Group /adapter/v1

## SubGroup channel:{channelId}:{userId}

### Message await_remote_interaction

+ Attributes
    + msisdn (string, required)
`;
      schemas = await generateSchemas(doc);
    });

    it('handles valid message', () => {
      const result = validateWebsocketResponse({
        channel: 'channel:1234:a6b29b64',
        messageTitle: 'await_remote_interaction',
        data: {
          msisdn: '79250002233',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles invalid message', () => {
      const result = validateWebsocketResponse({
        channel: 'channel:1234:a6b29b64',
        messageTitle: 'await_remote_interaction',
        data: {
          cliend_id: 'MegaFon',
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.invalid);
      assert.equal(result.checkedSchemas.length, 1);
      assert.equal(result.checkedSchemas[0].errors.length, 1);
      assert.equal(result.checkedSchemas[0].errors[0].message, 'Missing required property: msisdn');
    });

    it('handles message with invalid channel', () => {
      const result = validateWebsocketResponse({
        channel: 'channel:1234',
        messageTitle: 'await_remote_interaction',
        data: {
          msisdn: '79250002233',
          amr: ['USSD_OK'],
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.schemaNotFound);
    });
  });

  describe('message with no content', () => {
    let schemas;

    beforeEach(async () => {
      const doc = `
# My API

# Group /adapter/v1

## SubGroup channel:{userId}

### Message cancel_await_remote_interaction

Отменить процесс аутентификации.
`;
      schemas = await generateSchemas(doc);
    });

    it('handles valid message (no data)', () => {
      const result = validateWebsocketResponse({
        channel: 'channel:a6b29b64',
        messageTitle: 'cancel_await_remote_interaction',
        schemas,
      });
      assert.equal(result.status, validationStatus.valid);
    });

    it('handles invalid message (has some data)', () => {
      const result = validateWebsocketResponse({
        channel: 'channel:a6b29b64',
        messageTitle: 'cancel_await_remote_interaction',
        data: {
          msisdn: '79250002233',
          amr: ['USSD_OK'],
        },
        schemas,
      });
      assert.equal(result.status, validationStatus.invalid);
      assert.equal(result.checkedSchemas.length, 1);
      assert.equal(result.checkedSchemas[0].errors.length, 1);
      assert.equal(result.checkedSchemas[0].errors[0].message, 'Invalid type: object (expected null)');
    });
  });
});
