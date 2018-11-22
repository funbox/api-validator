import tv4 from '@funbox/tv4';

export const validationStatus = {
  valid: 'valid',
  invalid: 'invalid',
  schemaNotFound: 'schemaNotFound',
};

export function validateResponse({ method, url, data, schemas, basePath } = {}) {
  for (let i = 0; i < schemas.length; ++i) {
    const schema = schemas[i];

    let regExpStr = schema.href;
    regExpStr = regExpStr.replace(/\/?{\?[^}]+}/g, '');
    regExpStr = regExpStr.replace(/{[^}/]+}/g, '[^/]+');
    regExpStr = `^${basePath}${regExpStr}(?:\\?|$)`;
    const regExp = new RegExp(regExpStr);

    if (method === schema.method && regExp.test(url) && schema.definition.properties.status.enum.indexOf(data.status) >= 0) {
      const result = tv4.validateMultiple(data, schema.definition);
      if (result.valid) {
        return { status: validationStatus.valid };
      }
      return {
        status: validationStatus.invalid,
        errors: result.errors,
      };
    }
  }

  return { status: validationStatus.schemaNotFound };
}
