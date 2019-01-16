export default function getQueryParams(queryString) {
  if (!queryString) {
    return [];
  }
  const params = [];
  queryString.split('&').forEach(param => {
    const [name, value] = param.split('=');
    // Удаление скобок в нотации массива: "foo[]" и "foo[0]" будут преобразованы в "foo".
    const nameWithoutBrackets = name.replace(/\[[^\]]*\]$/, '');
    params.push({
      name: nameWithoutBrackets,
      value,
    });
  });
  return params;
}
