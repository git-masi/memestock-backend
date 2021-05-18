import Ajv from 'ajv';
import { httpMethods } from '../utils/http';

export const emailRegex =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const emailPattern = emailRegex.toString().replace(/\//g, '');

export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;

export const passwordPattern = passwordRegex.toString().replace(/\//g, '');

const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

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

export function validRequestFor(event) {
  return validateSchemaFor(event.httpMethod);

  function validateSchemaFor(method) {
    return ajv.compile(httpSchemas[method])(event);
  }
}
