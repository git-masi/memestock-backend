import { DynamoDB } from 'aws-sdk';

const dynamoDb = new DynamoDB.DocumentClient();

async function triggerAiAction(event, context) {
  try {
    const now = new Date();
    const getItemParams = {
      TableName: process.env.AI_ACTIONS_TABLE_NAME,
      IndexName: 'created',
      KeyConditionExpression: 'yearHashKey = :hkey AND created <= :rkey',
      ExpressionAttributeValues: {
        ':hkey': now.getFullYear() + '',
        ':rkey': now.toISOString(),
      },
      Limit: 1,
      ScanIndexForward: false,
    };

    const res = await dynamoDb.query(getItemParams).promise();
    console.log(res);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = triggerAiAction;
