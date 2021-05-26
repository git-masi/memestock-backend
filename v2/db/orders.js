import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
// import { getCompanies } from './companies';
// import { validUserAttributes, userTypes } from '../schema/users';
// import { guardItem } from './shared';
// import { getRandomInt, getRandomValueFromArray } from '../utils/dynamicValues';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export async function createOrder(orderAttributes) {
  return dynamoDb
    .transactWrite(createOrderTransaction(orderAttributes))
    .promise();
}

function createOrderTransaction(orderAttributes) {
  const { orderType, userId, companyPkSk, total, quantity } = orderAttributes;
  const created = new Date().toISOString();
  const sk = `${created}#${nanoid(8)}`;
  const result = {
    TransactItems: [
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          Item: {
            pk: 'ORDER',
            sk,
            created,
            companyPkSk,
            total,
            quantity,
            buyer: orderType === 'buy' ? userId : '',
            seller: orderType === 'sell' ? userId : '',
            originatingUser: userId,
            orderType,
            orderStatus: 'open',
          },
        },
      },
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          Item: {
            pk: `USER_ORDER`,
            sk: `${userId}#ORDER#${sk}`,
            orderPkSk: `ORDER#${sk}`,
            userPkSk: `USER#${userId}`,
            status: 'open', // use this as a filter
            orderType, // use this as a filter
          },
        },
      },
    ],
  };

  return result;
}
