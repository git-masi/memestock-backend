export function successResponse(body) {
  return {
    statusCode: 200,
    body: JSON.stringify(body),
  };
}

export function successResponseCors(body) {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
