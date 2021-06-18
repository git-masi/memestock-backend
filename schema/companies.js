// import Ajv from 'ajv';
// import { httpMethods } from '../utils/http';
import { pkPrefixes } from './pkPrefixes';

// const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

export const companySkPattern = '[A-Z]{2,4}';

export const companyPkSkPattern = `${pkPrefixes.company}#${companySkPattern}`;
