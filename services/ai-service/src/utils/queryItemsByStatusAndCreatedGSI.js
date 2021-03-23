import { DynamoDB } from 'aws-sdk';
import { statuses } from './statuses';

const { GSI_STATUS_AND_CREATED } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export const getMostRecentItem = (tableName) =>
  queryItemByStatusAndCreated(tableName, false);

export const getFirstItemCreated = (tableName) =>
  queryItemByStatusAndCreated(tableName);

function queryItemByStatusAndCreated(tableName, orderAsc = true) {
  const params = {
    TableName: tableName,
    IndexName: GSI_STATUS_AND_CREATED,
    KeyConditionExpression: '#status = :status AND #created <= :now',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#created': 'created',
    },
    ExpressionAttributeValues: {
      ':status': statuses.created,
      ':now': new Date().toISOString(),
    },
    Limit: 1,
    ScanIndexForward: orderAsc,
  };

  return dynamoDb.query(params).promise();
}
