import Ajv from 'ajv';
import { httpMethods } from '../utils/http';
import {
  emailPattern,
  utcIsoStringPattern,
  createRegexGroup,
} from '../utils/regex';
import { pkPrefixes } from './pkPrefixes';

const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

export const userTypes = Object.freeze({
  human: 'HUMAN',
  ai: 'AI',
});

export const userSkPattern = `${createRegexGroup(
  userTypes
)}#${utcIsoStringPattern}#[\\w\\-_]{8}`;

export const userPkSkPattern = `^${pkPrefixes.user}#${userSkPattern}$`;

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

export function validUserAttributes(userAttributes) {
  console.log(userAttributes);
  const userAttributesSechma = {
    type: 'object',
    properties: {
      sk: {
        type: 'string',
        pattern: `^${userSkPattern}$`,
      },
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
      created: {
        type: 'string',
        pattern: `^${utcIsoStringPattern}$`,
      },
      nextAi: {
        type: 'object',
        properties: {
          pk: {
            type: 'string',
            pattern: `${pkPrefixes.user}`,
          },
          sk: {
            type: 'string',
            pattern: `^${userSkPattern}$`,
          },
        },
      },
      collector: {
        type: 'integer',
      },
      fomo: {
        type: 'integer',
      },
      lossAversion: {
        type: 'integer',
      },
      wildcard: {
        type: 'integer',
      },
    },
    required: ['displayName', 'sk'],
  };

  console.log(userAttributesSechma);

  return ajv.compile(userAttributesSechma)(userAttributes);
}
