import Ajv from 'ajv';
import {
  createRegexGroup,
  startAndEndPattern,
  utcIsoStringPattern,
} from '../utils/regex';
import { companyPkSkPattern, companySkPattern } from './companies';
import { userPkSkPattern } from './users';

const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

export const orderSkPattern = `${utcIsoStringPattern}#[\\w\\-_]{8}`;

export const orderTypes = Object.freeze({
  buy: 'buy',
  sell: 'sell',
});

export const orderStatuses = Object.freeze({
  open: 'open',
  cancelled: 'cancelled',
  fulfilled: 'fulfilled',
});

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
        minimum: 1,
      },
      quantity: {
        type: 'integer',
        minimum: 1,
      },
    },
    required: ['orderType', 'userPkSk', 'companyPkSk', 'total', 'quantity'],
  };

  return ajv.compile(schema)(orderAttributes);
}
