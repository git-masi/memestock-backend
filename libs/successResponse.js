export function successResponse(data) {
  const body =
    data instanceof Object
      ? JSON.stringify(data)
      : typeof data === 'string'
      ? data
      : '';

  return {
    statusCode: 200,
    body,
  };
}

export function successResponseCors(data) {
  const body =
    data instanceof Object
      ? JSON.stringify(data)
      : typeof data === 'string'
      ? data
      : '';

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    body,
  };
}
