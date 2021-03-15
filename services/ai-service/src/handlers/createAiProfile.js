import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import { randomInt } from 'd3-random';
import { commonMiddleware, successResponse } from 'libs';

const dynamoDb = new DynamoDB.DocumentClient();

const baseChaoticRiskProfile = {
  fomo: 15,
  lossAversion: 0,
  collector: 5,
  wildcard: 20,
};

const baseConservativeRiskProfile = {
  fomo: 0,
  lossAversion: 25,
  collector: 10,
  wildcard: 5,
};

const baseAgressiveRiskProfile = {
  fomo: 20,
  lossAversion: 0,
  collector: 10,
  wildcard: 10,
};

const baseProfiles = [
  baseChaoticRiskProfile,
  baseConservativeRiskProfile,
  baseAgressiveRiskProfile,
];

const getRandomIntZeroToX = (x) => randomInt(0, x)();

const getRandomValueFromArray = (arr) =>
  arr instanceof Array && arr[getRandomIntZeroToX(arr.length)];

function addRandomPointsToProfile(baseProfile) {
  const copy = { ...baseProfile };
  const keys = Object.keys(baseProfile);
  for (let key of keys) {
    copy[key] = copy[key] + getRandomIntZeroToX(10);
  }
  return copy;
}

async function createAiProfile(event, context) {
  try {
    const baseProfile = getRandomValueFromArray(baseProfiles);
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
