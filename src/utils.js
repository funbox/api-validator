const path = require('node:path');
const fs = require('node:fs').promises;

const ERROR_LINES_PADDING = 4;
const ROW_HIGHLIGHT_MARK = '>';
const COLUMN_HIGHLIGHT_MARK = '^';

const ANSI_RED = '\x1b[31m';
const ANSI_ALL_OFF = '\x1b[0m';

function astHasError(parseResult) {
  const errorAnnotationIndex = parseResult.annotations.findIndex(anno => anno.type === 'error');
  if (errorAnnotationIndex > -1) {
    const anno = parseResult.annotations[errorAnnotationIndex];
    const { text } = anno;

    if (!anno.sourceMap) {
      return [true, { text }];
    }

    const position = anno.sourceMap.charBlocks[0];
    return [true, { text, position, file: position.file }];
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
        Object.keys(subschema.properties || {}).forEach(key => {
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

async function logCrafterError(inputFile, errorDetails) {
  try {
    const { text: errorText, file: errorFile, position } = errorDetails;
    const requestedFile = errorFile ? path.resolve(path.dirname(inputFile), errorFile) : inputFile;

    if (!position) {
      const text = createErrorText(requestedFile, errorText);
      console.log(text);
      return;
    }

    const sourceLinesForError = await getSourceLinesForError(requestedFile, position);
    const text = createErrorText(requestedFile, errorText, sourceLinesForError);
    console.log(text);
  } catch (e) {
    console.log(e);
  }
}

async function getSourceLinesForError(requestedFile, errorPosition) {
  const fileSourceLines = await getFileLines(requestedFile);
  const originalLines = { ...errorPosition };
  const paddedLines = {
    startLine: Math.max(errorPosition.startLine - ERROR_LINES_PADDING, 1),
    endLine: Math.min(errorPosition.endLine + ERROR_LINES_PADDING, fileSourceLines.length),
  };
  return getSourceLinesSubset(fileSourceLines, paddedLines, originalLines);
}

async function getFileLines(fileName) {
  const source = await fs.readFile(fileName, { encoding: 'utf-8' });
  return source.split('\n');
}

function getSourceLinesSubset(fullSourceLines, paddedLines, originalLines) {
  const { startLine, endLine } = paddedLines;

  const linesSubset = fullSourceLines
    .slice(startLine - 1, endLine)
    .map((line, index) => {
      const position = index + startLine;
      const highlightedRow = position >= originalLines.startLine && position <= originalLines.endLine;
      return ({
        text: line,
        position,
        highlightedRow,
      });
    });
  const firstHighlightedLineIndex = linesSubset.findIndex(line => line.highlightedRow);

  return [
    ...linesSubset.slice(0, firstHighlightedLineIndex + 1),
    {
      text: `${COLUMN_HIGHLIGHT_MARK}`.padStart(originalLines.startColumn),
      position: null,
      highlightedRow: true,
    },
    ...linesSubset.slice(firstHighlightedLineIndex + 1),
  ];
}

function createErrorText(fileName, errorText, errorDetails) {
  const details = Array.isArray(errorDetails) && errorDetails.length > 0 ? getErrorDetails(errorDetails) : [];
  return [
    ANSI_RED,
    `ERROR in ${fileName}`,
    `Crafter Error: ${errorText}`,
    ANSI_ALL_OFF,
    ...details,
  ].join('\n');
}

function getErrorDetails(errorDetails, colorize = true) {
  const maxPosition = errorDetails[errorDetails.length - 1].position;
  return errorDetails.map(line => getErrorLineText(line, maxPosition, colorize));
}

function getErrorLineText(line, maxPosition, colorize) {
  const padSymbols = line.highlightedRow ? ` ${ROW_HIGHLIGHT_MARK}` : ` ${' '.repeat(ROW_HIGHLIGHT_MARK.length)}`;
  const maxPositionString = maxPosition.toString(10);
  const positionString = line.position ? line.position.toString(10) : '';
  const positionSymbols = positionString.padStart(maxPositionString.length);
  const text = `${padSymbols} ${positionSymbols} | ${line.text}`;

  return colorize && line.highlightedRow ? colorizeText(text, ANSI_RED) : text;
}

function colorizeText(text, ANSIColor) {
  return `${ANSIColor}${text}${ANSI_ALL_OFF}`;
}

module.exports = {
  astHasError,
  deleteDescriptions,
  getGroups,
  getMessages,
  getResources,
  getSubgroupsAndMessages,
  logCrafterError,
};
