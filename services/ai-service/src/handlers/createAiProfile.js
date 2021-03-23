import { DynamoDB } from 'aws-sdk';
import {
  commonMiddleware,
  successResponse,
  getRandomIntZeroToX,
  getRandomValueFromArray,
} from 'libs';
import { baseAiProfiles } from '../utils/baseAiProfiles';
import { createCommonAttributes } from '../utils/createCommonAttributes';
import { getMostRecentItem } from '../utils/getMostRecentItem';

const { AI_PROFILES_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

async function createAiProfile(event, context) {
  try {
    const newAiProfile = createNewAiProfile();
    const newAiParams = {
      TableName: AI_PROFILES_TABLE_NAME,
      Item: newAiProfile,
    };

    // todo: Add new user. Use the returned ID of the new user in the ai profile
    await updatePrevAiProfile(newAiProfile);
    await dynamoDb.put(newAiParams).promise();

    return successResponse(newAiProfile);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createAiProfile);

function createNewAiProfile() {
  const baseProfile = getRandomValueFromArray(baseAiProfiles);
  const profileWithRandomPoints = addRandomPointsToProfile(baseProfile);

  return {
    ...profileWithRandomPoints,
    ...createCommonAttributes(),
  };
}

function addRandomPointsToProfile(baseProfile) {
  const copy = { ...baseProfile };
  const keys = Object.keys(baseProfile);
  for (let key of keys) {
    copy[key] = copy[key] + getRandomIntZeroToX(10);
  }
  return copy;
}

async function updatePrevAiProfile(newAiProfile) {
  const { Items } = await getMostRecentItem(AI_PROFILES_TABLE_NAME);

  if (Items[0]) {
    const { id } = Items[0];

    await dynamoDb
      .update({
        TableName: AI_PROFILES_TABLE_NAME,
        Key: { id },
        UpdateExpression: 'SET #nextAiId = :newAiId',
        ExpressionAttributeNames: { '#nextAiId': 'nextAiId' },
        ExpressionAttributeValues: {
          ':newAiId': newAiProfile?.id,
        },
      })
      .promise();
  }
}
