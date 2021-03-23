import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import {
  getFirstItemCreated,
  getMostRecentItem,
} from '../utils/queryItemsByStatusAndCreatedGSI';

const { AI_ACTIONS_TABLE_NAME, AI_PROFILES_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

const createAiActionParams = {
  TableName: AI_ACTIONS_TABLE_NAME,
  Item: {
    id: uuid(),
    created: new Date().toISOString(),
    // status: statuses.completed,
  },
};

console.log(createAiActionParams);

export const handler = async function executeAiAction(event, context) {
  try {
    const { Items } = await getNextAiProfile();
    const aiProfile = Items[0];
    console.log(aiProfile);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

async function getNextAiProfile() {
  const { Items } = await getMostRecentItem(AI_ACTIONS_TABLE_NAME);

  if (Items[0]) {
    // todo: destructure userId as well
    const { nextAiId } = Items[0];
    return dynamoDb
      .get({
        TableName: AI_PROFILES_TABLE_NAME,
        Key: {
          id: nextAiId,
        },
      })
      .promise();
  }

  return getFirstItemCreated(AI_PROFILES_TABLE_NAME);
}
