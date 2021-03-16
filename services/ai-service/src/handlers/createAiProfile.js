import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import {
  commonMiddleware,
  successResponse,
  getRandomIntZeroToX,
  getRandomValueFromArray,
} from 'libs';
import { baseAiProfiles } from '../utils/baseAiProfiles';

const dynamoDb = new DynamoDB.DocumentClient();

async function createAiProfile(event, context) {
  try {
    const baseProfile = getRandomValueFromArray(baseAiProfiles);
    const profileWithRandomPoints = addRandomPointsToProfile(baseProfile);
    const now = new Date().toISOString();

    const aiProfile = {
      ...profileWithRandomPoints,
      id: uuid(),
      created: now,
    };

    const params = {
      TableName: process.env.AI_PROFILES_TABLE_NAME,
      Item: aiProfile,
    };

    // todo: Add new user. Use the returned ID of the new user in the ai profile
    await dynamoDb.put(params).promise();

    return successResponse(aiProfile);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createAiProfile);

function addRandomPointsToProfile(baseProfile) {
  const copy = { ...baseProfile };
  const keys = Object.keys(baseProfile);
  for (let key of keys) {
    copy[key] = copy[key] + getRandomIntZeroToX(10);
  }
  return copy;
}
