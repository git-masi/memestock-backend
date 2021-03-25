import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpEventNormalizer from '@middy/http-event-normalizer';
import httpErrorHandler from '@middy/http-error-handler';
import validator from '@middy/validator';

const commonMiddlewareGroup = [
  httpJsonBodyParser(),
  httpEventNormalizer(),
  httpErrorHandler(),
];

export const commonMiddleware = (handler) =>
  middy(handler).use(commonMiddlewareGroup);

// see validation options here: https://www.npmjs.com/package/@middy/validator
// example: { inputSchema: SOME_JSON_SCHEMA }
export const commonMiddlewareWithValidator = (handler, validationOptions) =>
  middy(handler).use(commonMiddlewareGroup).use(validator(validationOptions));
