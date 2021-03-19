import { DynamoDB } from 'aws-sdk';
import { statuses } from './statuses';

const { GSI_STATUS_AND_CREATED } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export function getMostRecentItem(tableName) {
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
    ScanIndexForward: false,
  };

  return dynamoDb.query(params).promise();
}
