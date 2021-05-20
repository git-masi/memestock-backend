import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { internet } from 'faker';
import { getRandomValueFromArray } from '../../services/ai-service/node_modules/libs';
import { baseAiProfiles } from '../utils/ai';
import { getRandomInt } from '../utils/dynamicValues';
import { userTypes } from '../schema/users';
import { userItem } from './users';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createAi() {
  const sk = `AI#${new Date().toISOString()}#${nanoid(8)}`;
  const aiQueryResult = await getAiBySortKey('last');
  const mostRecentAi = aiQueryResult?.Items?.[0] ?? null;

  const userAttributes = {
    sk,
    displayName: internet.userName(),
    nextAi: {
      pk: 'USER',
      sk: mostRecentAi?.nextAi?.sk ?? sk,
    },
    ...addRandomPointsToProfile(getRandomValueFromArray(baseAiProfiles)),
  };

  console.log(userAttributes);

  const user = await userItem(userAttributes);

  return user;

  // const params = {
  //   TableName: MAIN_TABLE_NAME,
  // };
  // const aiQueryResult = await getAiBySortKey();
  // const mostRecentAi = aiQueryResult?.Items?.[0] ?? null;
  // createAiProfile(mostRecentAi);
  // return dynamoDb.transactWrite(params).promise();
}

function addRandomPointsToProfile(baseProfile) {
  const copy = { ...baseProfile };
  const keys = Object.keys(baseProfile);

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

// async function aiUser(displayName) {
//   const aiUserParams = { sk: `AI#${new Date().toISOString()}#${nanoid(8)}` };
//   const result = {
//     TransactItems: [
//       {
//         Put: await userItem(displayName, aiUserParams),
//       },
//       {
//         Put: guardItem('DISPLAY_NAME', displayName),
//       },
//     ],
//   };

//   return result;
// }
