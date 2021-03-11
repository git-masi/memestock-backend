// CREATE
// There should be a route to create a user
// The route should accept a unique displayName (there should be a reasonable limit to the length)
// A user should be saved in the Users table
// A new UUID should be generated
// A created time should be added as an ISO string
// A randomly generated amount of starting cash should be added (there should be a reasonable min/max)
// A randomly generated number of starting stocks should be added (there should be a reasonable min/max)

// Modules
import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';

import { commonMiddleware } from '../lib/commonMiddleware';
import { successResponse } from '../lib/successResponse';

const dynamoDB = new DynamoDB.DocumentClient();

async function createUser(event, context) {
  console.log(process.env.USERS_TABLE_NAME);
  try {
    const now = new Date();

    const user = {
      id: uuid(),
      created: now.toISOString(),
    };

    const params = {
      TableName: process.env.USERS_TABLE_NAME,
      Item: user,
    };

    await dynamoDB.put(params).promise();

    return successResponse({ message: 'User created!' });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createUser);
