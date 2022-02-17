export default function getQueryParams(queryString) {
  if (!queryString) {
    return [];
  }
  const params = [];
  queryString.split('&').forEach(param => {
    const [name, value] = param.split('=');
    // Delete square brackets from the array signature: "foo[]" and "foo[0]" will be transformed to "foo".
    const nameWithoutBrackets = name.replace(/\[[^\]]*\]$/, '');
    params.push({
      name: nameWithoutBrackets,
      value,
    });
  });
  return params;
}
