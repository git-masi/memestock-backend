import cloneDeep from 'lodash.clonedeep';

export const httpMethods = Object.freeze({
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
});

export class HttpError extends Error {
  constructor(statusCode = 500, body) {
    super();
    this.statusCode = statusCode;
    this.body = body;
  }

  static BadRequest = (body) => new HttpError(400, body);
}

export function apiResponse(config = {}) {
  try {
    validateApiResponseConfig(config);

    const {
      statusCode = 200,
      cors = false,
      event,
      whitelist,
      headers,
      body,
    } = config;

    const response = { statusCode };

    if (cors) {
      if (event && whitelist) {
        const origin = event?.headers?.origin ?? '';
        if (whitelist.includes(origin)) {
          response.headers = {
            ...response.headers,
            'Access-Control-Allow-Origin': origin,
          };
        } else {
          console.log(
            `request origin not in whitelist\norigin: ${origin}\nwhitelist: ${JSON.stringify(
              whitelist
            )}`
          );
          throw new HttpError(400);
        }
      } else {
        response.headers = {
          ...response.headers,
          'Access-Control-Allow-Origin': '*',
        };
      }
    }

    if (headers) {
      const copy = cloneDeep(headers);

      if (cors) {
        delete copy['Access-Control-Allow-Origin'];
      }

      // example headers:
      // 'Access-Control-Allow-Credentials': true,
      // 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE',
      response.headers = {
        ...response.headers,
        ...copy,
      };
    }

    if (body instanceof Object) {
      response.body = JSON.stringify(body);
    }

    if (typeof body === 'string') {
      response.body = body;
    }

    return response;
  } catch (error) {
    console.log(error);
    if (error instanceof HttpError) return { ...error };
    return {
      statusCode: 500,
    };
  }
}

function validateApiResponseConfig(config) {
  const { statusCode = 200, cors = false, event, whitelist, headers } = config;

  if (typeof statusCode !== 'number')
    throw new Error('statusCode config must be a number');

  if (typeof cors !== 'boolean')
    throw new Error('cors config must be a boolean');

  if (headers && headers.constructor.name !== 'Object')
    throw new Error('headers config must be an object');

  if (
    whitelist &&
    (!(whitelist instanceof Array) ||
      whitelist.some((item) => typeof item !== 'string'))
  )
    throw new Error('whitelist config must be an array of strings');

  if (
    event &&
    (event.constructor.name !== 'Object' ||
      typeof event?.headers?.origin !== 'string')
  )
    throw new Error('event config must be api gateway event');
}
