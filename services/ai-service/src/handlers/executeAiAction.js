// import { DynamoDB } from 'aws-sdk';
// import { v4 as uuid } from 'uuid';
import { getMostRecentItem } from '../utils/getMostRecentItem';

const { AI_ACTIONS_TABLE_NAME } = process.env;
// const dynamoDb = new DynamoDB.DocumentClient();

// const createAiActionParams = {
//   TableName: AI_ACTIONS_TABLE_NAME,
//   Item: {
//     id: uuid(),
//     created: new Date().toISOString(),
//     status: statuses.completed,
//   },
// };

async function executeAiAction(event, context) {
  try {
    const { Items } = await getMostRecentItem(AI_ACTIONS_TABLE_NAME);
    console.log(Items);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = executeAiAction;
