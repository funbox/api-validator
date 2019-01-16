import tv4 from '@funbox/tv4';

export const validationStatus = {
  valid: 'valid',
  invalid: 'invalid',
  schemaNotFound: 'schemaNotFound',
};

export function validateResponse({ method, url, data, schemas, basePath = '' } = {}) {
  let normalizedUrl = url;

  // Удаляем basePath.
  normalizedUrl = normalizedUrl.slice(basePath.length);
  // Удаляем query-параметры.
  normalizedUrl = normalizedUrl.split('?')[0];

  const responseUrlSegments = normalizedUrl.split('/').filter(s => s.length > 0);

  let foundSchemas = schemas.filter(schema => (
    schema.method === method
    && schema.definition.properties.status.enum.indexOf(data.status) >= 0
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

  if (foundSchemas.length === 0) {
    return { status: validationStatus.schemaNotFound };
  }

  const result = tv4.validateMultiple(data, foundSchemas[0].definition);
  if (result.valid) {
    return { status: validationStatus.valid };
  }
  return {
    status: validationStatus.invalid,
    errors: result.errors,
  };
}
