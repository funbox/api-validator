import tv4 from '@funbox/tv4';
import getQueryParams from './get-query-params';

export const validationStatus = {
  valid: 'valid',
  invalid: 'invalid',
  schemaNotFound: 'schemaNotFound',
};

export function validateResponse({ method, url, data, schemas, basePath = '' } = {}) {
  const urlWithoutBasePath = url.slice(basePath.length);
  const [urlWithoutQueryString, queryString] = urlWithoutBasePath.split('?');
  const responseUrlSegments = urlWithoutQueryString.split('/').filter(s => s.length > 0);
  const responseQueryParams = getQueryParams(queryString);

  let foundSchemas = schemas.filter(schema => (
    schema.method === method
    && schema.urlSegments.length === responseUrlSegments.length
  ));

  // Ищем схемы с подходящими URL: проверяем сегменты по очереди, предпочитая совпадения по статическим сегментам.
  // Например, если пришел ответ с URL "/books/user", и у нас есть две подходящие схемы: "/books/{bookId}" и "/books/user",
  // будет выбрана схема "/books/user".
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
      // Оставляем только схемы со статическими сегментами.
      matchingSchemas = matchingSchemas.filter(schema => !schema.urlSegments[segIdx].isRegExp);
    }
    foundSchemas = matchingSchemas;
  });

  let maxMatchedStaticQueryParamsCount = 0;

  // Оставляем схемы, статичные query-параметры которых присутствуют в URL ответа.
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

  // Оставляем схемы с максимальным количеством совпавших статичных query-параметров.
  foundSchemas = foundSchemas.filter(schema => schema.staticQueryParams.length === maxMatchedStaticQueryParamsCount);

  // Оставляем схемы, обязательные динамические query-параметры которых присутствуют в URL ответа.
  foundSchemas = foundSchemas.filter(schema => (
    schema.requiredDynamicQueryParams.every(schemaParamName => (
      responseQueryParams.find(responseParam => (
        responseParam.name === schemaParamName
      ))
    ))
  ));

  // Первой окажется схема, у которой больше всего обязательных динамических query-параметров.
  foundSchemas.sort((schemaA, schemaB) => (schemaB.requiredDynamicQueryParams.length - schemaA.requiredDynamicQueryParams.length));

  if (foundSchemas.length === 0) {
    return { status: validationStatus.schemaNotFound };
  }

  const checkedSchemas = [];

  for (let i = 0; i < foundSchemas.length; ++i) {
    const schema = foundSchemas[i];
    const result = tv4.validateMultiple(data, schema.definition);
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
