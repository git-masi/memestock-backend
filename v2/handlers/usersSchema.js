import Ajv from 'ajv';
import { httpMethods } from '../utils/http';

const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

const schemas = Object.freeze({
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
        // properties: {},
        // required: [],
      },
    },
    required: ['body'],
  },
  [httpMethods.PUT]: {},
  [httpMethods.DELETE]: {},
});

export function validRequestFor(anEvent) {
  return validateSchemaFor(anEvent.httpMethod);

  function validateSchemaFor(aMethod) {
    return ajv.compile(schemas[aMethod])(anEvent);
  }
}
