import { validationStatus, validateResponse } from '../src/validate-response';

const assert = require('assert');
const generateSchemas = require('../src/generate-schemas');

describe('validateResponse', () => {
  describe('simple doc', () => {
    let schemas;

    beforeEach(() => {
      const doc = `
# GET /users
+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
        + result (string, required)
      `;
      schemas = generateSchemas(doc);
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
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].message, 'Missing required property: result');
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

    beforeEach(() => {
      const doc = `
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
      schemas = generateSchemas(doc);
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
});
