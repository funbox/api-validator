import getQueryParams from './get-query-params';

const Crafter = require('@funbox/crafter');

const logger = {
  warn(text, details) {
    const [linePos, currentFile] = details;
    const positionText = linePos ? ` at line ${linePos}` : '';
    const fileText = currentFile ? ` (see ${currentFile})` : '';
    console.error('\x1b[33m%s\x1b[0m', `Warning${positionText}${fileText}: ${text}`); // yellow color
  },
};

module.exports = function generateSchemas(doc, isFilePath) {
  const ast = Crafter[isFilePath ? 'parseFileSync' : 'parseSync'](doc, { logger })[0].toRefract();
  const schemas = [];
  const subGroups = [];
  const messages = [];
  const groups = getGroups(ast.content);
  const resources = getResources(ast.content);

  groups.forEach((group) => {
    const { messages: groupMessages, subgroups: groupSubgroups } = getSubgroupsAndMessages(group);
    messages.push(...groupMessages);
    subGroups.push(...groupSubgroups);
  });

  subGroups.forEach((subGroup) => {
    const channelTitle = subGroup.meta && subGroup.meta.title.content;
    let channel = channelTitle;

    if (!channelTitle) {
      console.log('Заголовок секции «SubGroup» отсутствует и не может быть использован для валидации канала.');
      process.exit(1);
    }

    const hasVariables = /{([^}]+)}/.test(channelTitle);
    if (hasVariables) {
      // Экранирование специальных символов сегмента, за исключением "{" и "}".
      channel = channel.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      // Замена переменных на регулярные выражения.
      channel = channel.replace(/{([^}]+)}/g, '.+');
      channel = `^${channel}$`;
    }

    const subgroupMessages = getMessages(subGroup.content);
    messages.push(...subgroupMessages.map(msg => ({ ...msg, channel: { isRegExp: hasVariables, value: channel } })));
  });

  messages.forEach((message) => {
    const messageTitle = message.meta && message.meta.title.content || null;
    const schemaElement = message.content.find((obj) => obj.attributes && obj.attributes.contentType && obj.attributes.contentType.content === 'application/schema+json');
    let definition;

    if (schemaElement) {
      definition = JSON.parse(schemaElement.content);
      deleteDescriptions(definition);
    } else {
      definition = { type: 'null' };
    }
    schemas.push({ type: 'websocket', messageTitle, channel: message.channel || 'none', definition });
  });

  resources.forEach((resource) => {
    resource.content.forEach((transition) => {
      if (!Array.isArray(transition.content)) {
        return;
      }

      transition.content.forEach((transaction) => {
        if (Array.isArray(transaction.content)) {
          const request = transaction.content.find((obj) => obj.element === 'httpRequest');
          const response = transaction.content.find((obj) => obj.element === 'httpResponse');
          const schemaElement = response.content.find((obj) => obj.attributes && obj.attributes.contentType && obj.attributes.contentType.content === 'application/schema+json');
          if (schemaElement) {
            const method = request.attributes.method.content;
            const transitionAttrs = transition.attributes || {};

            const href = (transitionAttrs.href && transitionAttrs.href.content) || resource.attributes.href.content;
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
                const type = variable.meta ? variable.meta.title.content : '';

                let regExp = typesRegExps.string;
                if (type === 'enum') {
                  const enumValues = variable.content.value.attributes.enumerations.content.map(it => it.content);
                  regExp = enumValues.join('|');
                } else if (type in typesRegExps) {
                  regExp = typesRegExps[type];
                }
                variablesRegExps[name] = regExp;

                const isRequired = !!variable.attributes.typeAttributes.content.find(it => it.content === 'required');
                if (isRequired) {
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
            schemas.push({ type: 'rest', method, urlSegments, staticQueryParams, requiredDynamicQueryParams, definition });
          }
        }
      });
    });
  });

  return schemas;
};

function getGroups(content) {
  const groups = [];
  content.forEach(obj => {
    if (obj.element === 'category' && getCategoryClassname(obj) === 'resourceGroup') {
      groups.push(obj);
    } else if (Array.isArray(obj.content)) {
      Array.prototype.push.apply(groups, getGroups(obj.content));
    }
  });
  return groups;
}

function getSubgroupsAndMessages(group) {
  const messages = getMessages(group.content);
  const subgroups = getSubgroups(group.content);

  return { messages, subgroups };
}

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

function getMessages(content) {
  const messages = [];
  content.forEach(obj => {
    if (obj.element === 'message') {
      messages.push(obj);
    }
  });
  return messages;
}

function getSubgroups(content) {
  const subgroups = [];
  content.forEach(obj => {
    if (obj.element === 'category' && getCategoryClassname(obj) === 'subGroup') {
      subgroups.push(obj);
    }
  });
  return subgroups;
}

function deleteDescriptions(schema) {
  delete schema.description; // eslint-disable-line no-param-reassign
  switch (schema.type) {
    case 'object': {
      if (schema.properties) {
        Object.keys(schema.properties).forEach(key => {
          deleteDescriptions(schema.properties[key]);
        });
      }
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

function getCategoryClassname(category) {
  return (
    Array.isArray(category.meta.classes)
      ? category.meta.classes[0]
      : (category.meta.classes.content && category.meta.classes.content[0].content)
  );
}
