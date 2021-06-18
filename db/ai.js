import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { internet } from 'faker';
import { getRandomValueFromArray } from '../../services/ai-service/node_modules/libs';
import { baseAiProfiles } from '../utils/ai';
import { getRandomInt } from '../utils/dynamicValues';
import { userTypes } from '../schema/users';
import { createUserItem as _createUserItem } from './users';
import { getFirstItem, guardItem } from './shared';
import { pkPrefixes } from '../schema/pkPrefixes';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createAi() {
  return dynamoDb.transactWrite(await createAiUserTransaction()).promise();
}

async function createAiUserTransaction() {
  const { userItem, prevAiUpdate, displayName } = await createUserItem();

  const result = {
    TransactItems: [
      {
        Put: userItem,
      },
      {
        Put: guardItem(pkPrefixes.displayName, displayName),
      },
    ],
  };

  if (prevAiUpdate) {
    result.TransactItems.push(prevAiUpdate);
  }

  return result;
}

async function createUserItem() {
  const mostRecentAi = await getMostRecentAi();
  const userAttributes = await createAiUserAttributes(mostRecentAi);
  const { sk, displayName } = userAttributes;
  const userItem = await _createUserItem(userAttributes);
  const prevAiUpdate = createPrevAiUpdate(mostRecentAi, sk);

  return { userItem, prevAiUpdate, displayName };
}

async function getMostRecentAi() {
  return getFirstItem(await getFirstOrLastAi('last'));
}

export function getFirstOrLastAi(searchOrder = 'first') {
  return dynamoDb
    .query({
      TableName: MAIN_TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk)',
      ExpressionAttributeNames: {
        '#pk': 'pk',
        '#sk': 'sk',
      },
      ExpressionAttributeValues: {
        ':pk': pkPrefixes.user,
        ':sk': `${userTypes.ai}`,
      },
      ScanIndexForward: searchOrder !== 'last',
      Limit: 1,
    })
    .promise();
}

async function createAiUserAttributes(mostRecentAi) {
  const created = new Date().toISOString();
  const sk = `${userTypes.ai}#${created}#${nanoid(8)}`;

  const result = {
    sk,
    created,
    displayName: internet.userName(),
    nextAi: {
      pk: pkPrefixes.user,
      sk: mostRecentAi?.nextAi?.sk ?? sk,
    },
    ...createBaseProfile(),
  };

  return result;
}

function createBaseProfile() {
  const copy = { ...getRandomValueFromArray(baseAiProfiles) };
  const keys = Object.keys(copy);

  for (let key of keys) {
    copy[key] = copy[key] + getRandomInt(0, 10);
  }

  return copy;
}

function createPrevAiUpdate(mostRecentAi, sk) {
  if (mostRecentAi) {
    return {
      Update: {
        TableName: MAIN_TABLE_NAME,
        Key: {
          pk: mostRecentAi.pk,
          sk: mostRecentAi.sk,
        },
        UpdateExpression: 'SET #nextAi.#nestedSk = :nestedSk',
        ExpressionAttributeNames: {
          '#nextAi': 'nextAi',
          '#nestedSk': 'sk',
        },
        ExpressionAttributeValues: {
          ':nestedSk': sk,
        },
      },
    };
  }

  return null;
}

export function getMostRecentAiAction() {
  return dynamoDb
    .query({
      TableName: MAIN_TABLE_NAME,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: {
        '#pk': 'pk',
      },
      ExpressionAttributeValues: {
        ':pk': pkPrefixes.aiAction,
      },
      ScanIndexForward: false,
      Limit: 1,
    })
    .promise();
}

export function getAiByPkSk(pk, sk) {
  return dynamoDb
    .get({
      TableName: MAIN_TABLE_NAME,
      Key: {
        pk,
        sk,
      },
    })
    .promise();
}

export function createAiAction(aiAction, aiProfile) {
  return dynamoDb
    .put({
      TableName: MAIN_TABLE_NAME,
      Item: {
        pk: pkPrefixes.aiAction,
        sk: new Date().toISOString(),
        aiTakingAction: `${aiProfile.pk}#${aiProfile.sk}`,
        nextAi: aiProfile.nextAi,
        ...aiAction,
      },
    })
    .promise();
}
