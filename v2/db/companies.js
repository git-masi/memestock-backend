import { DynamoDB } from 'aws-sdk';
import { guardItem } from './shared';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export function getCompanies() {
  const params = {
    TableName: MAIN_TABLE_NAME,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: {
      '#pk': 'pk',
    },
    ExpressionAttributeValues: {
      ':pk': 'COMPANY',
    },
  };
  return dynamoDb.query(params).promise();
}

function createCompanyFromHttpEvent(event) {
  const params = createCompanyParams(event);
  return dynamoDb.transactWrite(params).promise();
}

function createCompanyParams(event) {
  const {
    body: { name, tickerSymbol, description, pricePerShare },
  } = event;

  return {
    TransactItems: [
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          ConditionExpression: 'attribute_not_exists(pk)',
          Item: {
            pk: 'COMPANY',
            sk: tickerSymbol,
            name,
            tickerSymbol,
            description,
            pricePerShare,
          },
        },
      },
      {
        Put: guardItem('COMPANY_NAME', name),
      },
      {
        Put: guardItem('TICKER_SYMBOL', tickerSymbol),
      },
    ],
  };
}

// Used to prevent duplicate entries for an attribute
function guardItem(prefix, value) {
  return {
    TableName: MAIN_TABLE_NAME,
    ConditionExpression: 'attribute_not_exists(pk)',
    Item: {
      pk: `${prefix}#${value}`,
      sk: value,
    },
  };
}
