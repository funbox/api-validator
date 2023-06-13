const getQueryParams = require('./get-query-params').default;

const Crafter = require('@funboxteam/crafter');
const {
  astHasError,
  deleteDescriptions,
  getGroups,
  getMessages,
  getResources,
  getSubgroupsAndMessages,
} = require('./utils');

const logger = {
  warn(text, details) {
    const [linePos, currentFile] = details;
    const positionText = linePos ? ` at line ${linePos}` : '';
    const fileText = currentFile ? ` (see ${currentFile})` : '';
    console.error('\x1b[33m%s\x1b[0m', `Warning${positionText}${fileText}: ${text}`); // yellow color
  },
};

module.exports = async function generateSchemas(doc, isFilePath) {
  const [parseResult] = await Crafter[isFilePath ? 'parseFile' : 'parse'](doc, { logger });
  const ast = parseResult.toRefract();
  const schemas = [];
  const subGroups = [];
  const messages = [];
  const groups = getGroups(ast.content);
  const resources = getResources(ast.content);
  const [hasError, errorDetails] = astHasError(parseResult);

  if (hasError) {
    return { schemas, error: errorDetails };
  }

  groups.forEach((group) => {
    const { messages: groupMessages, subgroups: groupSubgroups } = getSubgroupsAndMessages(group);
    messages.push(...groupMessages);
    subGroups.push(...groupSubgroups);
  });

  subGroups.forEach((subGroup) => {
    const channelTitle = subGroup.meta && subGroup.meta.title.content;
    let channel = channelTitle;

    if (!channelTitle) {
      console.log('A header of a Subgroup section is not found and cannot be used for validation purposes');
      process.exit(1);
    }

    const hasVariables = /{([^}]+)}/.test(channelTitle);
    if (hasVariables) {
      // Escape special symbols excluding "{" and "}".
      channel = channel.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      // Replace a dynamic part with a regular expression
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

          const method = request.attributes.method.content;
          const statusCode = response.attributes.statusCode.content;
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

          // Transform URL into an array of segments to make code simpler
          const urlSegments = hrefWithoutStaticQueryParams.split('/').filter(s => s.length > 0).map(segment => {
            let value = segment;
            const hasVariables = segment.indexOf('{') !== -1;
            if (hasVariables) {
              // Escape special symbols excluding "{" and "}".
              value = value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
              // Replace a dynamic part with a regular expression
              value = value.replace(/{([^}/]+)}/g, (match, name) => variablesRegExps[name] || typesRegExps.string);
              value = `^${value}$`;
            }
            return { isRegExp: hasVariables, value };
          });

          let definition;

          if (schemaElement) {
            definition = JSON.parse(schemaElement.content);
            deleteDescriptions(definition);
          }

          schemas.push({ type: 'rest', method, statusCode, urlSegments, staticQueryParams, requiredDynamicQueryParams, definition });
        }
      });
    });
  });

  return { schemas, error: null };
};
