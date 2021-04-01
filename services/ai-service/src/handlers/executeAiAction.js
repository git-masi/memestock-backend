import { DynamoDB } from 'aws-sdk';
import axios from 'axios';
import { createAttributesForStatusAndCreatedQuery } from 'libs';
import {
  getFirstItemCreated,
  getMostRecentItem,
} from '../utils/queryItemsByStatusAndCreatedGSI';

const {
  AI_ACTIONS_TABLE_NAME,
  AI_PROFILES_TABLE_NAME,
  USER_SERVICE_URL,
} = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export const handler = async function executeAiAction(event, context) {
  try {
    const res = await getNextAiProfile();
    const aiProfile = getItemFromResult(res);
    const user = getUser(aiProfile);
    console.log(user);
    // todo: take action based on aiProfile
    const params = {
      TableName: AI_ACTIONS_TABLE_NAME,
      Item: {
        ...createAttributesForStatusAndCreatedQuery(),
        aiProfileId: aiProfile.id,
        nextAiId: aiProfile.nextAiId,
      },
    };

    await dynamoDb.put(params).promise();
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

function getItemFromResult(res) {
  return res.Item ? res.Item : res.Items ? res.Items[0] : null;
}

async function getUser(aiProfile) {
  const { userId } = aiProfile;
  const user = axios.get(`${USER_SERVICE_URL}/user?userId=${userId}`);
  return user;
}
