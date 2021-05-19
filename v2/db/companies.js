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

export function createCompany(companyConfig) {
  const params = createCompanyParams(companyConfig);
  return dynamoDb.transactWrite(params).promise();
}

function createCompanyParams(companyConfig) {
  const { name, tickerSymbol, description, pricePerShare } = companyConfig;

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
