import Ajv from 'ajv';
import { httpMethods } from '../utils/http';
import { emailPattern } from '../utils/regex';

const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

export const userTypes = Object.freeze({
  human: 'HUMAN',
  ai: 'AI',
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
    required: ['body'],
  },
  [httpMethods.POST]: {
    type: 'object',
    properties: {
      body: {
        type: 'object',
        properties: {
          displayName: {
            type: 'string',
            minLength: 5,
            maxLength: 36,
            pattern: '^\\S*$',
          },
          email: {
            type: 'string',
            pattern: emailPattern,
          },
        },
        required: ['displayName', 'email'],
      },
    },
    required: ['body'],
  },
  [httpMethods.PUT]: {},
  [httpMethods.DELETE]: {},
});

export function validUsersHttpEvent(event) {
  return validateHttpSchema(event.httpMethod);

  function validateHttpSchema(method) {
    return ajv.compile(httpSchemas[method])(event);
  }
}

export function validUserConfig(userConfig) {
  const userConfigSechma = {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        pattern: emailPattern,
      },
      displayName: {
        type: 'string',
        minLength: 5,
        maxLength: 36,
        pattern: '^\\S*$',
      },
      type: {
        type: 'string',
        pattern: `^${Object.values(userTypes).join('|')}$`,
      },
    },
    required: ['displayName', 'type'],
  };

  return ajv.compile(userConfigSechma)(userConfig);
}