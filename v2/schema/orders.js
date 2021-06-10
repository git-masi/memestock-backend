import Ajv from 'ajv';
import { httpMethods } from '../utils/http';
import {
  createRegexGroup,
  startAndEndPattern,
  utcIsoStringPattern,
} from '../utils/regex';
import { companyPkSkPattern, companySkPattern } from './companies';
import { userPkSkPattern, userSkPattern } from './users';

const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

const orderSkPattern = `${utcIsoStringPattern}#[\\w\\-_]{8}`;

export const orderTypes = Object.freeze({
  buy: 'buy',
  sell: 'sell',
});

export const orderStatuses = Object.freeze({
  open: 'open',
  cancelled: 'cancelled',
  fulfilled: 'fulfilled',
});

const httpSchemas = Object.freeze({
  [httpMethods.GET]: {
    type: 'object',
    properties: {
      queryStringParameters: {
        type: 'object',
        // properties: {},
        // required: [],
      },
    },
    required: ['queryStringParameters'],
  },
  [httpMethods.POST]: {
    type: 'object',
    properties: {
      body: {
        type: 'object',
        properties: {
          user: { type: 'string', pattern: startAndEndPattern(userSkPattern) },
          orderType: {
            type: 'string',
            pattern: startAndEndPattern(createRegexGroup(orderTypes)),
          },
          tickerSymbol: {
            type: 'string',
            pattern: startAndEndPattern(companySkPattern),
          },
          total: { type: 'integer', minimum: 1 },
          quantity: { type: 'integer', minimum: 1 },
        },
        required: ['user', 'orderType', 'tickerSymbol', 'total', 'quantity'],
      },
    },
    required: ['body'],
  },
  [httpMethods.PUT]: {
    type: 'object',
    properties: {
      body: {
        type: 'object',

        order: {
          type: 'string',
          pattern: startAndEndPattern(orderSkPattern),
        },
        user: {
          type: 'string',
          pattern: startAndEndPattern(userSkPattern),
        },
        required: ['order', 'user'],
      },
    },
    required: ['body'],
  },
  [httpMethods.DELETE]: {},
});

export function validOrdersHttpEvent(event) {
  return validateHttpSchema(event.httpMethod);

  function validateHttpSchema(method) {
    return ajv.compile(httpSchemas[method])(event);
  }
}

export function validOrderAttributes(orderAttributes) {
  const schema = {
    type: 'object',
    properties: {
      orderType: {
        type: 'string',
        pattern: startAndEndPattern(createRegexGroup(orderTypes)),
      },
      userPkSk: {
        type: 'string',
        pattern: startAndEndPattern(userPkSkPattern),
      },
      companyPkSk: {
        type: 'string',
        pattern: startAndEndPattern(companyPkSkPattern),
      },
      tickerSymbol: {
        type: 'string',
        pattern: startAndEndPattern(companySkPattern),
      },
      total: {
        type: 'integer',
      },
      quantity: {
        type: 'integer',
      },
    },
    required: ['orderType', 'userPkSk', 'companyPkSk', 'total', 'quantity'],
  };

  return ajv.compile(schema)(orderAttributes);
}
