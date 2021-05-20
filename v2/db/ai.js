import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { internet } from 'faker';
import { getRandomValueFromArray } from '../../services/ai-service/node_modules/libs';
import { baseAiProfiles } from '../utils/ai';
import { getRandomInt } from '../utils/dynamicValues';
import { userTypes } from '../schema/users';
import { userItem } from './users';
import { guardItem } from './shared';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createAi() {
  const created = new Date().toISOString();
  const sk = `AI#${created}#${nanoid(8)}`;
  const aiQueryResult = await getAiBySortKey('last');
  const mostRecentAi = aiQueryResult?.Items?.[0] ?? null;
  const displayName = internet.userName();

  const userAttributes = {
    sk,
    displayName,
    created,
    nextAi: {
      pk: 'USER',
      sk: mostRecentAi?.nextAi?.sk ?? sk,
    },
    ...createBaseProfile(),
  };

  const user = await userItem(userAttributes);

  let prevAi;

  if (mostRecentAi) {
    prevAi = {
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

  const transaction = aiUserTransaction(user, prevAi, displayName);

  return dynamoDb.transactWrite(transaction).promise();
}

function createBaseProfile() {
  const copy = { ...getRandomValueFromArray(baseAiProfiles) };
  const keys = Object.keys(copy);

  for (let key of keys) {
    copy[key] = copy[key] + getRandomInt(0, 10);
  }

  return copy;
}

function getAiBySortKey(searchOrder) {
  return dynamoDb
    .query({
      TableName: MAIN_TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk)',
      ExpressionAttributeNames: {
        '#pk': 'pk',
        '#sk': 'sk',
      },
      ExpressionAttributeValues: {
        ':pk': 'USER',
        ':sk': `${userTypes.ai}`,
      },
      ScanIndexForward: searchOrder !== 'last',
      Limit: 1,
    })
    .promise();
}

function aiUserTransaction(aiItem, prevAiItem, displayName) {
  const result = {
    TransactItems: [
      {
        Put: aiItem,
      },
      {
        Put: guardItem('DISPLAY_NAME', displayName),
      },
    ],
  };

  if (prevAiItem) {
    result.TransactItems.push(prevAiItem);
  }

  return result;
}
