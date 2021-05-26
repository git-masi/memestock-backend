import Ajv from 'ajv';
import { httpMethods } from '../utils/http';
import { createRegexGroup } from '../utils/regex';
import { companyPkSkPattern } from './companies';
import { userPkSkPattern } from './users';

const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

const orderTypes = Object.freeze({
  buy: 'buy',
  sell: 'sell',
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
        properties: {},
        required: [],
      },
    },
    required: ['body'],
  },
  [httpMethods.PUT]: {},
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
        pattern: `^${createRegexGroup(orderTypes)}$`,
      },
      userPkSk: {
        type: 'string',
        pattern: userPkSkPattern,
      },
      companyPkSk: {
        type: '',
        pattern: companyPkSkPattern,
      },
      total: {
        type: 'integer',
      },
      quantity: {
        type: 'integer',
      },
    },
  };

  return ajv.compile(schema)(orderAttributes);
}
