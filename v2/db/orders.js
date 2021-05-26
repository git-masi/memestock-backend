import { DynamoDB } from 'aws-sdk';
import { nanoid } from 'nanoid';
import { validOrderAttributes } from '../schema/orders';
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
  if (!validOrderAttributes(orderAttributes))
    throw new Error('Order attributes are invalid');

  const { orderType, userPkSk, companyPkSk, total, quantity } = orderAttributes;
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
            buyer: orderType === 'buy' ? userPkSk : '',
            seller: orderType === 'sell' ? userPkSk : '',
            originatingUser: userPkSk,
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
            sk: `${userPkSk}#ORDER#${sk}`,
            orderPkSk: `ORDER#${sk}`,
            userPkSk: `USER#${userPkSk}`,
            status: 'open', // use this as a filter
            orderType, // use this as a filter
          },
        },
      },
    ],
  };

  return result;
}
