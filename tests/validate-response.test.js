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

  describe('dynamic and static query params', () => {
    let schemas;

    beforeEach(() => {
      const doc = `
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
      schemas = generateSchemas(doc);
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

    beforeEach(() => {
      const doc = `
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
      schemas = generateSchemas(doc);
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

  it('handles arrays in parameters', () => {
    const doc = `
# Get arrays [GET /arrays/{?foo,bar}]
+ Parameters
    + foo: [1,2] (string, required) - array with two numbers
    + bar: [1,2] (string, required) - array with two numbers
+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
      `;
    const schemas = generateSchemas(doc);
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

    beforeEach(() => {
      const doc = `
# Get arrays [GET /foo/{varone}?path=test{&vartwo,varthree}]
+ Parameters
    + varone (number, required)
    + vartwo (string, required)
    + varthree (string, required)
+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
      `;
      schemas = generateSchemas(doc);
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

  it('handles parameters without attributes', () => {
    // Проверяем, что корректно обрабатывается параметр hello, у которого в Parameters не указаны атрибуты в скобках.
    const doc = `
# GET /foo{?hello}
+ Parameters
    + hello
+ Response 200 (application/json)
    + Attributes
        + status: ok (required, fixed)
      `;
    const schemas = generateSchemas(doc);
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

    beforeEach(() => {
      const doc = `
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
      schemas = generateSchemas(doc);
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
});
