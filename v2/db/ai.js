import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { internet } from 'faker';
import { getRandomValueFromArray } from '../../services/ai-service/node_modules/libs';
import { baseAiProfiles } from '../utils/ai';
import { getRandomInt } from '../utils/dynamicValues';
import { userTypes } from '../schema/users';
import { userItem } from './users';
import { getFirstItem, guardItem } from './shared';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createAi() {
  return dynamoDb.transactWrite(await createAiUserTransaction()).promise();
}

async function createAiUserTransaction() {
  const mostRecentAi = await getMostRecentAi();
  const userAttributes = await createAiUserAttributes(mostRecentAi);
  const { sk, displayName } = userAttributes;
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

  const result = {
    TransactItems: [
      {
        Put: user,
      },
      {
        Put: guardItem('DISPLAY_NAME', displayName),
      },
    ],
  };

  if (prevAi) {
    result.TransactItems.push(prevAi);
  }

  return result;
}

async function getMostRecentAi() {
  return getFirstItem(await getAiBySortKey('last'));
}

async function createAiUserAttributes(mostRecentAi) {
  const created = new Date().toISOString();
  const sk = `AI#${created}#${nanoid(8)}`;

  const result = {
    sk,
    created,
    displayName: internet.userName(),
    nextAi: {
      pk: 'USER',
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
