import { DynamoDB } from 'aws-sdk';
import axios from 'axios';
import { internet } from 'faker';
import {
  commonMiddleware,
  successResponse,
  getRandomIntZeroToX,
  getRandomValueFromArray,
} from 'libs';
import { baseAiProfiles } from '../utils/baseAiProfiles';
import { createCommonAttributes } from '../utils/createCommonAttributes';
import {
  getFirstItemCreated,
  getMostRecentItem,
} from '../utils/queryItemsByStatusAndCreatedGSI';

const { AI_PROFILES_TABLE_NAME, USER_SERVICE_URL } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const createUserPath = `${USER_SERVICE_URL}/users/create`;

async function createAiProfile(event, context) {
  try {
    const [newAiProfile, newUser] = await Promise.all([
      createNewAiProfile(),
      createNewUser(),
    ]);
    const putItem = { ...newAiProfile, userId: newUser.pk };
    const newAiParams = {
      TableName: AI_PROFILES_TABLE_NAME,
      Item: putItem,
    };

    await Promise.all([
      updatePrevAiProfile(newAiProfile),
      dynamoDb.put(newAiParams).promise(),
    ]);

    return successResponse(putItem);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(createAiProfile);

async function createNewUser() {
  const { data: item } = await axios.post(createUserPath, {
    displayName: internet.userName(),
    email: internet.email(),
  });
  return item;
}

async function createNewAiProfile() {
  const baseProfile = getRandomValueFromArray(baseAiProfiles);
  const profileWithRandomPoints = addRandomPointsToProfile(baseProfile);
  const commonAttributes = createCommonAttributes();
  const { Items } = await getFirstItemCreated(AI_PROFILES_TABLE_NAME);
  const firstItemId = Items[0]?.id;

  return {
    ...profileWithRandomPoints,
    ...commonAttributes,
    nextAiId: firstItemId ?? commonAttributes.id,
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
