import { DynamoDB } from 'aws-sdk';
import axios from 'axios';
import {
  createAttributesForStatusAndCreatedQuery,
  getRandomValueFromArray,
} from 'libs';
import {
  getFirstItemCreated,
  getMostRecentItem,
} from '../utils/queryItemsByStatusAndCreatedGSI';

const {
  AI_ACTIONS_TABLE_NAME,
  AI_PROFILES_TABLE_NAME,
  USER_SERVICE_URL,
  TRANSACTION_SERVICE_URL,
  ORDER_SERVICE_URL,
} = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const numOrdersToFetch = 20;
const numTransactionsToFetch = 20;

const test = true;

export const handler = async function executeAiAction(event, context) {
  try {
    const data = await getDataForUtilityScores();
    const utilityScores = await getUtilityScores(data);
    // todo: take action based on aiProfile
    console.log({ utilityScores });

    if (test) return;

    const params = {
      TableName: AI_ACTIONS_TABLE_NAME,
      Item: {
        ...createAttributesForStatusAndCreatedQuery(),
        currentAiId: data.aiProfile.id,
        nextAiId: data.aiProfile.nextAiId,
      },
    };

    await dynamoDb.put(params).promise();
  } catch (error) {
    console.log(error);
    throw error;
  }
};

async function getDataForUtilityScores() {
  const nextAiProfile = await getNextAiProfile();
  const aiProfile = getItemFromResult(nextAiProfile);
  const results = await Promise.allSettled([
    getUser(aiProfile),
    getOrders(),
    getTransactions(),
  ]);
  console.log(results);

  if (results.some((r) => r.status === 'rejected'))
    throw new Error('Failed to get data for ai action');

  const keyNames = ['user', 'orders', 'transactions'];

  return results.reduce(
    (acc, res, i) => {
      acc[keyNames[i]] = res.value;
      return acc;
    },
    { aiProfile }
  );
}

async function getNextAiProfile() {
  const { Items } = await getMostRecentItem(AI_ACTIONS_TABLE_NAME);

  if (Items[0]) {
    // todo: destructure userId as well
    const { nextAiId } = Items[0];
    return dynamoDb
      .get({
        TableName: AI_PROFILES_TABLE_NAME,
        Key: {
          id: nextAiId,
        },
      })
      .promise();
  }

  return getFirstItemCreated(AI_PROFILES_TABLE_NAME);
}

function getItemFromResult(res) {
  return res.Item ? res.Item : res.Items ? res.Items[0] : null;
}

async function getUser(aiProfile) {
  const { userId } = aiProfile;
  const { data } = await axios.get(`${USER_SERVICE_URL}/user?userId=${userId}`);
  return data;
}

async function getOrders() {
  const { data } = await axios.get(
    `${ORDER_SERVICE_URL}/order/open?limit=${numOrdersToFetch}&orderAsc=false`
  );
  return data;
}

async function getTransactions() {
  const { data } = await axios.get(
    `${TRANSACTION_SERVICE_URL}/transaction/many?limit=${numTransactionsToFetch}&orderAsc=false`
  );
  return data;
}

async function getUtilityScores(data) {
  console.log({ data });
  const { aiProfile, user, orders, transactions } = data;

  const possibleActions = {
    buyOrder: 'buyOrder',
    sellOrder: 'sellOrder',
    newBuyOrder: 'newBuyOrder',
    newSellOrder: 'newSellOrder',
    cancelBuyOrder: 'cancelBuyOrder',
    cancelSellOrder: 'cancelSellOrder',
  };

  const baseUtilityScores = {
    [possibleActions.buyOrder]: 20,
    [possibleActions.sellOrder]: 20,
  };

  const actionArgs = {
    data,
    possibleActions,
    baseUtilityScores,
  };

  const orderActions = getOrderActions(actionArgs);
}

function getOrderActions(args) {
  const {
    data: { orders, aiProfile },
    possibleActions,
    baseUtilityScores,
  } = args;
  const orderActions = [];

  const buyOrders = filterByOrderType(orders, 'buy');
  const sellOrders = filterByOrderType(orders, 'sell');
  const buyOrdersSorted = sortByStock(buyOrders);
  const sellOrdersSorted = sortByStock(sellOrders);
  const mostFrequentBuyOrders = getMostFrequentStock(buyOrdersSorted);
  const mostFrequentSellOrders = getMostFrequentStock(sellOrdersSorted);

  if (mostFrequentBuyOrders.length > 0) {
    orderActions.push({
      action: possibleActions.buyOrder,
      order: getRandomValueFromArray(mostFrequentBuyOrders[1]),
      score: baseUtilityScores.buyOrder + aiProfile.fomo,
    });
  }

  if (mostFrequentSellOrders.length > 0) {
    orderActions.push({
      action: possibleActions.sellOrder,
      order: getRandomValueFromArray(mostFrequentSellOrders[1]),
      score: baseUtilityScores.sellOrder + aiProfile.lossAversion,
    });
  }

  return orderActions;
}

function filterByOrderType(orders, type) {
  return orders.filter((order) => order?.orderType === type);
}

function sortByStock(orders) {
  return orders.reduce((acc, order) => {
    const symbol = order?.stock?.tickerSymbol;
    if (!acc[symbol]) acc[symbol] = [];
    acc[symbol].push(order);
    return acc;
  }, {});
}

function getMostFrequentStock(orders) {
  const entries = Object.entries(orders);
  if (entries.length === 0) return [];

  return entries.reduce((mostFrequent, entry) => {
    if (entry[1].length > mostFrequent[1].length) return entry;
    return mostFrequent;
  });
}
