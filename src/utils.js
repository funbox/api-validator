function astHasError(parseResult) {
  const errorAnnotationIndex = parseResult.annotations.findIndex(anno => anno.type === 'error');
  if (errorAnnotationIndex > -1) {
    const anno = parseResult.annotations[errorAnnotationIndex];
    const { text } = anno;

    if (!anno.sourceMap) {
      return [true, { text }];
    }

    const position = anno.sourceMap.charBlocks[0];
    const file = anno.sourceMap.file;
    return [true, { text, position, file }];
  }
  return [false];
}

function deleteDescriptions(schema) {
  delete schema.description; // eslint-disable-line no-param-reassign

  const schemaTypeIs = type => schema.type === type || (Array.isArray(schema.type) && schema.type.includes(type));

  if (schemaTypeIs('object')) {
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
    if (schema.definitions) {
      Object.keys(schema.definitions).forEach(key => {
        deleteDescriptions(schema.definitions[key]);
      });
    }
  } else if (schemaTypeIs('array')) {
    if (schema.items) {
      if (Array.isArray(schema.items)) {
        schema.items.forEach(item => {
          deleteDescriptions(item);
        });
      } else {
        deleteDescriptions(schema.items);
      }
    }
  }
}

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

function getMessages(content) {
  const messages = [];
  content.forEach(obj => {
    if (obj.element === 'message') {
      messages.push(obj);
    }
  });
  return messages;
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

function getSubgroupsAndMessages(group) {
  const messages = getMessages(group.content);
  const subgroups = getSubgroups(group.content);

  return { messages, subgroups };
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

function getCategoryClassname(category) {
  return (
    Array.isArray(category.meta.classes)
      ? category.meta.classes[0]
      : (category.meta.classes.content && category.meta.classes.content[0].content)
  );
}

module.exports = {
  astHasError,
  deleteDescriptions,
  getGroups,
  getMessages,
  getResources,
  getSubgroupsAndMessages,
};
