import jsonschema from 'jsonschema';
import getQueryParams from './get-query-params';

export const validationStatus = {
  valid: 'valid',
  invalid: 'invalid',
  schemaNotFound: 'schemaNotFound',
};

function validate(data, schema) {
  return jsonschema.validate(data, schema, { nestedErrors: true });
}

export function validateWebsocketResponse({ messageTitle, channel, data = null, schemas }) {
  const checkedSchemas = [];
  const strictCheck = !!messageTitle;

  const foundSchemas = schemas.filter(schema => {
    const typeMatch = schema.type === 'websocket';
    const messageTitleMatch = messageTitle ? messageTitle === schema.messageTitle : true;
    let channelMatch = false;
    if (schema.channel.isRegExp) {
      const regExp = new RegExp(schema.channel.value);
      channelMatch = regExp.test(channel);
    } else {
      channelMatch = channel === schema.channel.value;
    }
    return typeMatch && messageTitleMatch && channelMatch;
  });

  if (foundSchemas.length === 0) {
    return { status: validationStatus.schemaNotFound };
  }

  for (let i = 0; i < foundSchemas.length; ++i) {
    const schema = foundSchemas[i];
    const result = validate(data, schema.definition);
    if (result.valid) {
      return { status: validationStatus.valid };
    }
    checkedSchemas.push({
      schema,
      errors: result.errors,
    });
  }

  // If a message to validate lacks a title and no corresponding schema is found,
  // consider no schema found at all. Otherwise, every schema will be marked as erroneous.
  if (!strictCheck) {
    return { status: validationStatus.schemaNotFound };
  }

  return {
    status: validationStatus.invalid,
    checkedSchemas,
  };
}

export function validateResponse({ method, url, data, schemas, basePath = '', statusField = '' } = {}) {
  const urlWithoutBasePath = url.slice(basePath.length);
  const [urlWithoutQueryString, queryString] = urlWithoutBasePath.split('?');
  const responseUrlSegments = urlWithoutQueryString.split('/').filter(s => s.length > 0);
  const responseQueryParams = getQueryParams(queryString);

  let foundSchemas = schemas.filter(schema => (
    schema.type === 'rest'
    && schema.method === method
    && schema.urlSegments.length === responseUrlSegments.length
  ));

  if (statusField) {
    if (data && data[statusField]) {
      foundSchemas = foundSchemas.filter(schema => (
        schema.definition.properties
        && schema.definition.properties[statusField]
        && schema.definition.properties[statusField].enum.indexOf(data[statusField]) >= 0
      ));
    } else {
      return { status: validationStatus.schemaNotFound };
    }
  }

  // Look for a schema with matching URL: check segments one by one, preferring matches on static segments.
  // E.g. if we have a response with the URL "/books/user" and two schemas are matching ("/books/{bookId}" and "/books/user"),
  // schema "/books/user" will be selected.
  responseUrlSegments.forEach((responseSegment, segIdx) => {
    let matchingSchemas = [];
    let atLeastOneStaticMatch = false;
    foundSchemas.forEach((schema) => {
      const schemaSegment = schema.urlSegments[segIdx];
      let match = false;
      if (schemaSegment.isRegExp) {
        const regExp = new RegExp(schemaSegment.value);
        match = regExp.test(responseSegment);
      } else {
        match = schemaSegment.value === responseSegment;
        if (match) {
          atLeastOneStaticMatch = true;
        }
      }
      if (match) {
        matchingSchemas.push(schema);
      }
    });
    if (atLeastOneStaticMatch) {
      // Leave only schemas with static segments
      matchingSchemas = matchingSchemas.filter(schema => !schema.urlSegments[segIdx].isRegExp);
    }
    foundSchemas = matchingSchemas;
  });

  let maxMatchedStaticQueryParamsCount = 0;

  // Leave schemas whose static parameters are present in the response URL
  foundSchemas = foundSchemas.filter(schema => {
    const allStaticParamsArePresent = schema.staticQueryParams.every(staticParam => (
      responseQueryParams.find(responseParam => (
        responseParam.name === staticParam.name && responseParam.value === staticParam.value
      ))
    ));
    if (allStaticParamsArePresent && schema.staticQueryParams.length > maxMatchedStaticQueryParamsCount) {
      maxMatchedStaticQueryParamsCount = schema.staticQueryParams.length;
    }
    return allStaticParamsArePresent;
  });

  // Leave schemas with the maximum number of matching static query parameters.
  foundSchemas = foundSchemas.filter(schema => schema.staticQueryParams.length === maxMatchedStaticQueryParamsCount);

  // Leave schemas whose mandatory dynamic parameters are present in the response URL
  foundSchemas = foundSchemas.filter(schema => (
    schema.requiredDynamicQueryParams.every(schemaParamName => (
      responseQueryParams.find(responseParam => (
        responseParam.name === schemaParamName
      ))
    ))
  ));

  // The first one will be the schema which has the maximum number of mandatory dynamic parameters
  foundSchemas.sort((schemaA, schemaB) => (schemaB.requiredDynamicQueryParams.length - schemaA.requiredDynamicQueryParams.length));

  if (foundSchemas.length === 0) {
    return { status: validationStatus.schemaNotFound };
  }

  const checkedSchemas = [];

  for (let i = 0; i < foundSchemas.length; ++i) {
    const schema = foundSchemas[i];
    const result = validate(data, schema.definition);
    if (result.valid) {
      return { status: validationStatus.valid };
    }
    checkedSchemas.push({
      schema,
      errors: result.errors,
    });
  }

  return {
    status: validationStatus.invalid,
    checkedSchemas,
  };
}
