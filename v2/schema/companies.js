import Ajv from 'ajv';
import { httpMethods } from '../utils/http';
import { pkPrefixes } from './pkPrefixes';

const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

export const companySkPattern = '[A-Z]{2,4}';

export const companyPkSkPattern = `${pkPrefixes.company}#${companySkPattern}`;

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
    required: ['body'],
  },
  [httpMethods.POST]: {
    type: 'object',
    properties: {
      body: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
          },
          tickerSymbol: {
            type: 'string',
            pattern: `^${companySkPattern}$`,
          },
          description: {
            type: 'string',
            minLength: 1,
          },
          pricePerShare: {
            type: 'integer',
            minimum: 1,
          },
        },
        required: ['name', 'tickerSymbol', 'description', 'pricePerShare'],
      },
    },
    required: ['body'],
  },
  [httpMethods.PUT]: {},
  [httpMethods.DELETE]: {},
});

export function validCompaniesHttpEvent(event) {
  return validateHttpSchema(event.httpMethod);

  function validateHttpSchema(method) {
    return ajv.compile(httpSchemas[method])(event);
  }
}
