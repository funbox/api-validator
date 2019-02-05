import getQueryParams from './get-query-params';

const protagonist = require('@funbox/protagonist');

module.exports = function generateSchemas(doc) {
  const ast = protagonist.parseSync(doc);
  const schemas = [];
  const resources = getResources(ast.content);

  resources.forEach((resource) => {
    resource.content.forEach((transition) => {
      if (!Array.isArray(transition.content)) {
        return;
      }

      transition.content.forEach((transaction) => {
        if (Array.isArray(transaction.content)) {
          const request = transaction.content.find((obj) => obj.element === 'httpRequest');
          const response = transaction.content.find((obj) => obj.element === 'httpResponse');
          const schemaElement = response.content.find((obj) => obj.attributes && obj.attributes.contentType === 'application/schema+json');
          if (schemaElement) {
            const method = request.attributes.method;
            const transitionAttrs = transition.attributes || {};

            const href = transitionAttrs.href || resource.attributes.href;
            const hrefWithoutDynamicQueryParams = href.replace(/{[?&][^}]+}/, '');

            const [hrefWithoutStaticQueryParams, staticQueryString] = hrefWithoutDynamicQueryParams.split('?');
            const staticQueryParams = getQueryParams(staticQueryString);

            const dynamicQueryParamsMatch = href.match(/{[?&]([^}]+)}/);
            const dynamicQueryParams = dynamicQueryParamsMatch ? dynamicQueryParamsMatch[1].split(',') : [];

            const typesRegExps = {
              number: '[0-9]+',
              string: '[^/]+',
            };

            const variablesRegExps = {};
            const requiredVariables = [];

            if (transitionAttrs.hrefVariables) {
              transitionAttrs.hrefVariables.content.forEach(variable => {
                const name = variable.content.key.content;
                let type = variable.meta ? variable.meta.title : '';
                if (!(type in typesRegExps)) {
                  type = 'string';
                }
                variablesRegExps[name] = typesRegExps[type];

                if (variable.attributes.typeAttributes.indexOf('required') >= 0) {
                  requiredVariables.push(name);
                }
              });
            }

            const requiredDynamicQueryParams = dynamicQueryParams.filter(param => requiredVariables.indexOf(param) >= 0);

            // Преобразуем URL в массив сегментов для упрощения кода валидации.
            const urlSegments = hrefWithoutStaticQueryParams.split('/').filter(s => s.length > 0).map(segment => {
              let value = segment;
              const hasVariables = segment.indexOf('{') !== -1;
              if (hasVariables) {
                // Экранирование специальных символов сегмента, за исключением "{" и "}".
                value = value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
                // Замена переменных на регулярные выражения.
                value = value.replace(/{([^}/]+)}/g, (match, name) => variablesRegExps[name] || typesRegExps.string);
                value = `^${value}$`;
              }
              return { isRegExp: hasVariables, value };
            });

            const definition = JSON.parse(schemaElement.content);
            deleteDescriptions(definition);
            schemas.push({ method, urlSegments, staticQueryParams, requiredDynamicQueryParams, definition });
          }
        }
      });
    });
  });

  return schemas;
};

function getResources(content) {
  const resources = [];
  content.forEach(obj => {
    if (obj.element === 'resource') {
      resources.push(obj);
    } else if (Array.isArray(obj.content)) {
      Array.prototype.push.apply(resources, getResources(obj.content));
    }
  });
  return resources;
}

function deleteDescriptions(schema) {
  delete schema.description; // eslint-disable-line no-param-reassign
  switch (schema.type) {
    case 'object': {
      Object.keys(schema.properties).forEach(key => {
        deleteDescriptions(schema.properties[key]);
      });
      if (schema.oneOf) {
        schema.oneOf.forEach(subschema => {
          Object.keys(subschema.properties).forEach(key => {
            deleteDescriptions(subschema.properties[key]);
          });
        });
      }
      break;
    }
    case 'array': {
      if (schema.items) {
        if (Array.isArray(schema.items)) {
          schema.items.forEach(item => {
            deleteDescriptions(item);
          });
        } else {
          deleteDescriptions(schema.items);
        }
      }
      break;
    }
    // no default
  }
}
