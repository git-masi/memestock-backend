import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import { commonMiddleware, successResponse } from 'libs';

const dynamoDb = new DynamoDB.DocumentClient();

async function createAiProfile(event, context) {
  try {
    const now = new Date().toISOString();

    const profile = {
      id: uuid(),
      created: now,
      lastActionTime: now,
    };

    const params = {
      TableName: process.env.AI_PROFILES_TABLE_NAME,
      Item: profile,
    };

    const res = await dynamoDb.put(params).promise();
    console.log(res);

    return successResponse({ message: 'AI Profile created!' });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createAiProfile);
