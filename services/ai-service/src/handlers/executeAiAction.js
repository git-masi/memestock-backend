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
  COMPANY_SERVICE_URL,
} = process.env;
const dynamoDb = new DynamoDB.DocumentClient();
const numOrdersToFetch = 20;
const numTransactionsToFetch = 20;

// todo: delete after testing
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

// {
//   "description": "This is an online gaming platform designed for competitive Twitter battles for most likes and shares.",
//   "documentType": "record",
//   "name": "GameStonk",
//   "pk": "32dac7e1-4dc7-4315-91d5-ec8c9394da33",
//   "pricePerShare": 18784,
//   "tickerSymbol": "GMS"
// }

// {
//   "cashOnHand": 112267,
//   "created": "2021-04-08T19:17:37.949Z",
//   "displayName": "Gregg.Runolfsson",
//   "email": "Diana.Champlin@yahoo.com",
//   "pk": "3a4eb03f-3b8d-4563-9751-d055505798fc",
//   "stocks": {
//     "GMS": {
//       "id": "32dac7e1-4dc7-4315-91d5-ec8c9394da33",
//       "quantityHeld": 15,
//       "quantityOnHand": 15
//     },
//     "OTHR": {
//       "id": "7bbdaca6-4834-4177-924a-6c13c19101e5",
//       "quantityHeld": 1,
//       "quantityOnHand": 1
//     }
//   },
//   "totalCash": 112267
// }

const possibleActions = {
  buyOrder: 'buyOrder',
  sellOrder: 'sellOrder',
  newBuyOrder: 'newBuyOrder',
  newSellOrder: 'newSellOrder',
  cancelBuyOrder: 'cancelBuyOrder',
  cancelSellOrder: 'cancelSellOrder',
};

async function getUtilityScores(data) {
  console.log({ data });
  const { aiProfile, user, orders, transactions } = data;

  console.log(
    'log to shut the compiler up',
    !!aiProfile,
    !!user,
    !!orders,
    !!transactions
  );

  const companies = await getCompanies();

  // array of tuples ['TEST', {...userStockData}]
  const userStockValues = getUserStockValues(data.user, companies);

  console.log(JSON.stringify(userStockValues));

  const totalStockValue = getTotalStockValue(userStockValues);

  console.log(totalStockValue);

  const { lowCashBoost, highCashBoost } = getBaseScoreBoosts(
    data,
    totalStockValue
  );

  const baseUtilityScores = getBaseUtilityScores({
    highCashBoost,
    lowCashBoost,
  });

  console.log({ baseUtilityScores });

  if (test) return;

  const actionArgs = {
    data,
    possibleActions,
    baseUtilityScores,
  };

  const orderActions = getOrderActions(actionArgs);

  const transactionsSortedByStock = sortByStock(transactions);
  const pricePressure = calculatePricePressure(transactionsSortedByStock);

  console.log('log to shut the compiler up', !!orderActions, !!pricePressure);
}

async function getCompanies() {
  const { data } = await axios.get(`${COMPANY_SERVICE_URL}/company/all`);
  return data;
}

function getUserStockValues(user, companies) {
  return Object.entries(user?.stocks).map((entry) => {
    const [tickerSymbol, data] = entry;
    const { pricePerShare } = companies.find(
      (c) => c.tickerSymbol === tickerSymbol
    );
    return [tickerSymbol, { ...data, pricePerShare }];
  });
}

function getTotalStockValue(stockValuesArr) {
  return stockValuesArr.reduce((sum, stock) => {
    const data = stock[1];
    return sum + data.quantityHeld * data.pricePerShare;
  }, 0);
}

function getBaseScoreBoosts(data, totalStockValue) {
  const { user, aiProfile } = data;
  const wealthInCashVsStocks = user.totalCash / totalStockValue; // Infinity is all cash, 0 is all stocks
  const cashIsLow = wealthInCashVsStocks <= 0.08; // if true boost desire to sell: Math.ceil(aiProfile.lossAversion * wealthInCashVsStocks)
  const cashIsHigh = wealthInCashVsStocks >= 0.2; // if true boost desire to buy: Math.ceil(aiProfile.collector * wealthInCashVsStocks)
  const lowCashBoost = cashIsLow
    ? Math.ceil(aiProfile.lossAversion * wealthInCashVsStocks)
    : 0;
  const highCashBoost = cashIsHigh
    ? Math.ceil(aiProfile.collector * wealthInCashVsStocks)
    : 0;

  return { lowCashBoost, highCashBoost };
}

function getBaseUtilityScores(args) {
  const { highCashBoost, lowCashBoost } = args;
  return {
    [possibleActions.buyOrder]: 20 + highCashBoost,
    [possibleActions.sellOrder]: 20 + lowCashBoost,
    [possibleActions.newBuyOrder]: 20 + highCashBoost,
    [possibleActions.newSellOrder]: 20 + lowCashBoost,
    [possibleActions.cancelBuyOrder]: 20,
    [possibleActions.cancelSellOrder]: 20,
  };
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

function sortByStock(arr) {
  return arr.reduce((acc, order) => {
    const symbol = order?.stock?.tickerSymbol;
    if (!acc[symbol]) acc[symbol] = [];
    acc[symbol].push(order);
    return acc;
  }, {});
}

function getMostFrequentStock(obj) {
  const entries = Object.entries(obj);
  if (entries.length === 0) return [];

  return entries.reduce((mostFrequent, entry) => {
    const numOrdersCurrentStock = entry[1].length;
    const numOrdersMax = mostFrequent[1].length;
    if (numOrdersCurrentStock > numOrdersMax) return entry;
    return mostFrequent;
  });
}

function calculatePricePressure(sortedTransactions) {
  const entries = Object.entries(sortedTransactions);
  if (entries.length === 0) return {};

  return entries.reduce((acc, entry) => {
    const [tickerSymbol, transactions] = entry;
    const pricePerShare = transactions.map((t) => t.total / t.quantity);
    const priceChanges = pricePerShare.map((total, i) =>
      i === 0 ? 0 : total - pricePerShare[i - 1]
    );
    const change = priceChanges.reduce((sum, priceChange) => sum + priceChange);
    acc[tickerSymbol] = change;
    return acc;
  }, {});
}
