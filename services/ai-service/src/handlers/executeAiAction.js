/**
 *
 * This is some grade A spaghetti code 😅
 *
 */

import { DynamoDB } from 'aws-sdk';
import axios from 'axios';
import {
  createAttributesForStatusAndCreatedQuery,
  getRandomFloat,
  getRandomIntZeroToX,
  getRandomValueFromArray,
  successResponse,
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
const possibleActions = {
  buyOrder: 'buyOrder',
  sellOrder: 'sellOrder',
  newBuyOrder: 'newBuyOrder',
  newSellOrder: 'newSellOrder',
  cancelBuyOrder: 'cancelBuyOrder',
  cancelSellOrder: 'cancelSellOrder',
  doNothing: 'doNothing',
};

const baseUtilityScores = {
  [possibleActions.buyOrder]: 20,
  [possibleActions.sellOrder]: 20,
  [possibleActions.newBuyOrder]: 20,
  [possibleActions.newSellOrder]: 20,
  [possibleActions.cancelBuyOrder]: 20,
  [possibleActions.cancelSellOrder]: 20,
  [possibleActions.doNothing]: 10,
};

// todo: delete after testing
const test = true;

export const handler = async function executeAiAction(event, context) {
  try {
    const data = await getDataForUtilityScores();
    const actionsWithUtilityScores = await getUtilityScores(data);
    const aiAction = getOneAction(actionsWithUtilityScores);
    const actionTaken = takeAction(aiAction, data.user);

    if (test) return;

    const params = {
      TableName: AI_ACTIONS_TABLE_NAME,
      Item: {
        ...createAttributesForStatusAndCreatedQuery(),
        actionTaken,
        currentAiId: data.aiProfile.id,
        nextAiId: data.aiProfile.nextAiId,
      },
    };

    await dynamoDb.put(params).promise();

    // todo: delete later along with http event
    return successResponse('success');
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
    getRecentOrders(),
    getTransactions(),
    getCompanies(),
  ]);

  if (results.some((r) => r.status === 'rejected')) {
    console.log('Results from async data requests: ', results);
    throw new Error('Failed to get data for ai action');
  }

  const keyNames = ['user', 'orders', 'transactions', 'companies'];

  const data = results.reduce(
    (acc, res, i) => {
      acc[keyNames[i]] = res.value;
      return acc;
    },
    { aiProfile }
  );

  console.log({ orders: data.orders });

  const userOrders = await getUserOrders(data.user.pk);

  return { ...data, userOrders };
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

async function getRecentOrders() {
  const { data } = await axios.get(
    `${ORDER_SERVICE_URL}/order/status/open?limit=${numOrdersToFetch}&orderAsc=false`
  );
  return data;
}

async function getUserOrders(userId) {
  const { data } = await axios.get(
    `${ORDER_SERVICE_URL}/order/userId/${userId}?status=open&orderAsc=false`
  );
  return data;
}

async function getTransactions() {
  const { data } = await axios.get(
    `${TRANSACTION_SERVICE_URL}/transaction/many?limit=${numTransactionsToFetch}&orderAsc=false`
  );
  return data;
}

async function getCompanies() {
  const { data } = await axios.get(`${COMPANY_SERVICE_URL}/company/all`);
  return data;
}

async function getUtilityScores(data) {
  const userStockValues = getUserStockValues(data);
  const totalStockValue = getTotalStockValue(userStockValues);
  const { lowCashBoost, highCashBoost } = getHighLowCashBoosts(
    data,
    totalStockValue
  );
  const mostFreqBoosts = calculateBoostForMostFrequentOrders(data);
  const changeInPricePerShare = calculateChangeInPricePerShare(data);

  const actions = getAllPossibleActions({
    data,
    mostFreqBoosts,
    lowCashBoost,
    highCashBoost,
    userStockValues,
    totalStockValue,
    changeInPricePerShare,
  });

  console.log(actions);

  return actions;
}

function getUserStockValues(data) {
  const { user, companies } = data;
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

function getHighLowCashBoosts(data, totalStockValue) {
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

function calculateBoostForMostFrequentOrders(data) {
  const { orders, aiProfile } = data;

  const buyOrders = filterByOrderType(orders, 'buy');
  const sellOrders = filterByOrderType(orders, 'sell');
  const buyOrdersSorted = sortByStock(buyOrders);
  const sellOrdersSorted = sortByStock(sellOrders);
  const [mostFreqBuy] = getMostFrequentStock(buyOrdersSorted);
  const [mostFreqSell] = getMostFrequentStock(sellOrdersSorted);

  const boosts = {};

  if (mostFreqBuy)
    boosts.mostFreqBuy = { tickerSymbol: mostFreqBuy, boost: aiProfile.fomo };

  if (mostFreqSell)
    boosts.mostFreqSell = {
      tickerSymbol: mostFreqSell,
      boost: aiProfile.lossAversion,
    };

  return boosts;
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

function calculateChangeInPricePerShare(data) {
  const { transactions } = data;
  const transactionsSortedByStock = sortByStock(transactions);

  const priceChangeAcrossTransactions = calculatePriceChange(
    transactionsSortedByStock
  );

  // % change as decimal
  return calculateSharePriceChange(priceChangeAcrossTransactions, data);
}

function calculatePriceChange(sortedTransactions) {
  const entries = Object.entries(sortedTransactions);
  if (entries.length === 0) return {};

  return entries.reduce((acc, entry) => {
    // transactions in asc order by created date
    const [tickerSymbol, transactions] = entry;
    const pricePerShare = transactions.map((t) => t.total / t.quantity);
    const priceChanges = pricePerShare.map((price, i) =>
      i === pricePerShare.length - 1 ? 0 : price - pricePerShare[i + 1]
    );
    const change = priceChanges.reduce((sum, priceChange) => sum + priceChange);
    acc[tickerSymbol] = change; // cents
    return acc;
  }, {});
}

function calculateSharePriceChange(changes, data) {
  const { companies } = data;
  return Object.entries(changes).map((entry) => {
    const [tickerSymbol, change] = entry;
    const company = companies.find((c) => c.tickerSymbol === tickerSymbol);
    return { tickerSymbol, percentChange: change / company.pricePerShare };
  });
}

function getAllPossibleActions(args) {
  // these functions are wet >.<
  // todo: refactor
  const existingOrderActions = getExistingOrderActions(args);
  const newOrderActions = getNewOrderActions(args);
  const cancelOrderActions = getCancelOrderActions(args);
  const doNothing = {
    action: possibleActions.doNothing,
    data: {},
    utilityScore: baseUtilityScores.doNothing,
  };

  return [
    ...existingOrderActions,
    ...newOrderActions,
    ...cancelOrderActions,
    doNothing,
  ];
}

function getExistingOrderActions(args) {
  const {
    data,
    mostFreqBoosts,
    lowCashBoost,
    highCashBoost,
    // userStockValues,
    // totalStockValue,
    changeInPricePerShare,
  } = args;
  const { orders, user, aiProfile } = data;

  const notOwnOrders = orders.filter((o) => o.userId !== user.pk);
  const buyOrders = filterByOrderType(notOwnOrders, 'buy');
  const sellOrders = filterByOrderType(notOwnOrders, 'sell');
  const fillableBuyOrders = buyOrders.filter((o) => o.total <= user.cashOnHand);
  const fillableSellOrders = sellOrders.filter((o) => {
    const { tickerSymbol, quantity } = o.stock;
    const hasStock = `${tickerSymbol}` in user.stocks;
    if (!hasStock) return false;
    const hasQuantity = user.stocks[tickerSymbol].quantityOnHand <= quantity;
    return hasQuantity;
  });

  const possibleBuyOrderActions = fillableBuyOrders.map((o) => {
    console.log('buy order: ', o);
    const { tickerSymbol } = o.stock;
    const freqBoost =
      tickerSymbol in mostFreqBoosts?.mostFreqBuy
        ? mostFreqBoosts.mostFreqBuy.boost
        : 0;

    const changeInPPS = changeInPricePerShare.find(
      (obj) => obj.tickerSymbol === tickerSymbol
    );

    const pricePressureBoost =
      changeInPPS && changeInPPS > 0
        ? Math.ceil(
            changeInPPS.percentChange *
              ((aiProfile.fomo + aiProfile.wildcard) / 2)
          )
        : 0;

    const collectorBoost =
      tickerSymbol in user.stocks
        ? Math.ceil((aiProfile.collector + aiProfile.wildcard) / 2)
        : 0;

    return {
      action: possibleActions.buyOrder,
      data: o,
      utilityScore:
        baseUtilityScores.buyOrder +
        freqBoost +
        pricePressureBoost +
        highCashBoost +
        collectorBoost,
    };
  });

  const possibleSellOrderActions = fillableSellOrders.map((o) => {
    console.log('sell order: ', o);
    const { tickerSymbol } = o.stock;
    const freqBoost =
      tickerSymbol in mostFreqBoosts?.mostFreqSell
        ? mostFreqBoosts.mostFreqSell.boost
        : 0;

    const changeInPPS = changeInPricePerShare.find(
      (obj) => obj.tickerSymbol === tickerSymbol
    );

    const pricePressureBoost =
      changeInPPS && changeInPPS < 0
        ? Math.ceil(
            changeInPPS.percentChange *
              ((aiProfile.lossAversion + aiProfile.wildcard) / 2)
          )
        : 0;

    return {
      action: possibleActions.sellOrder,
      data: o,
      utilityScore:
        baseUtilityScores.sellOrder +
        freqBoost +
        pricePressureBoost +
        lowCashBoost,
    };
  });

  return [...possibleBuyOrderActions, ...possibleSellOrderActions];
}

function getNewOrderActions(args) {
  const {
    data,
    mostFreqBoosts,
    changeInPricePerShare,
    highCashBoost,
    lowCashBoost,
  } = args;
  const {
    user: { stocks, cashOnHand },
    aiProfile,
    companies,
  } = data;

  // todo: refactor to use reduce instead of map
  const possibleBuyOrderActions = companies.map((c) => {
    const { tickerSymbol, pricePerShare } = c;
    // if stock price too high return
    if (pricePerShare * 0.8 > cashOnHand) return;

    const freqBoost =
      tickerSymbol in mostFreqBoosts?.mostFreqBuy
        ? mostFreqBoosts.mostFreqBuy.boost
        : 0;

    const changeInPPS = changeInPricePerShare.find(
      (obj) => obj.tickerSymbol === tickerSymbol
    );

    const pricePressureBoost =
      changeInPPS && changeInPPS < 0 // want to buy if stock price is falling
        ? Math.ceil(
            changeInPPS.percentChange *
              ((aiProfile.fomo + aiProfile.wildcard) / 2)
          )
        : 0;

    const collectorBoost =
      tickerSymbol in stocks
        ? Math.ceil((aiProfile.collector + aiProfile.wildcard) / 2)
        : 0;

    return {
      action: possibleActions.newBuyOrder,
      data: c,
      utilityScore:
        baseUtilityScores.newBuyOrder +
        freqBoost +
        pricePressureBoost +
        highCashBoost +
        collectorBoost,
    };
  });

  // todo: refactor to use reduce instead of map
  const possibleSellOrderActions = companies.map((c) => {
    const { tickerSymbol } = c;
    // if user does not own stock return
    if (!(tickerSymbol in stocks)) return;

    const freqBoost =
      tickerSymbol in mostFreqBoosts?.mostFreqSell
        ? mostFreqBoosts.mostFreqSell.boost
        : 0;

    const changeInPPS = changeInPricePerShare.find(
      (obj) => obj.tickerSymbol === tickerSymbol
    );

    const pricePressureBoost =
      changeInPPS && changeInPPS > 0 // want to sell if price is rising
        ? Math.ceil(
            changeInPPS.percentChange *
              ((aiProfile.lossAversion + aiProfile.wildcard) / 2)
          )
        : 0;

    const lossAversionBoost =
      changeInPPS && changeInPPS < 0 // want to sell if price is falling, fear of loss
        ? Math.ceil(
            changeInPPS.percentChange *
              ((aiProfile.lossAversion + aiProfile.wildcard) / 2)
          )
        : 0;

    const randomActionBoostOptions = [pricePressureBoost, lossAversionBoost];

    return {
      action: possibleActions.sellOrder,
      data: c,
      utilityScore:
        baseUtilityScores.sellOrder +
        freqBoost +
        getRandomValueFromArray(randomActionBoostOptions) +
        lowCashBoost,
    };
  });

  // filter out undefined values
  // todo: remove filter fns when above todo refactors are done
  return [
    ...possibleBuyOrderActions.filter((o) => o),
    ...possibleSellOrderActions.filter((o) => o),
  ];
}

// todo: refactor to use cash on hand rather than total cash
//       for low/hight cash boosts
function getCancelOrderActions(args) {
  const { data, highCashBoost, lowCashBoost, changeInPricePerShare } = args;
  const { userOrders, aiProfile } = data;

  const buyOrders = filterByOrderType(userOrders, 'buy');
  const sellOrders = filterByOrderType(userOrders, 'sell');

  const buyOrderActions = buyOrders.map((o) => {
    const { tickerSymbol } = o.stock;

    const changeInPPS = changeInPricePerShare.find(
      (obj) => obj.tickerSymbol === tickerSymbol
    );

    // price is falling
    const pricePressureDownBoost =
      changeInPPS && changeInPPS < 0
        ? Math.ceil(
            changeInPPS.percentChange *
              ((aiProfile.lossAversion + aiProfile.wildcard) / 2)
          )
        : 0;

    // price is rising
    const pricePressureUpBoost =
      changeInPPS && changeInPPS > 0
        ? Math.ceil(changeInPPS.percentChange * aiProfile.wildcard)
        : 0;

    return {
      action: possibleActions.cancelBuyOrder,
      data: o,
      utilityScore:
        baseUtilityScores.cancelBuyOrder +
        pricePressureDownBoost -
        pricePressureUpBoost +
        lowCashBoost,
    };
  });

  const sellOrderActions = sellOrders.map((o) => {
    const { tickerSymbol } = o.stock;

    const changeInPPS = changeInPricePerShare.find(
      (obj) => obj.tickerSymbol === tickerSymbol
    );

    // price is falling
    const pricePressureDownBoost =
      changeInPPS && changeInPPS < 0
        ? Math.ceil(
            changeInPPS.percentChange *
              ((aiProfile.lossAversion + aiProfile.wildcard) / 2)
          )
        : 0;

    // price is rising
    const pricePressureUpBoost =
      changeInPPS && changeInPPS > 0
        ? Math.ceil(changeInPPS.percentChange * aiProfile.wildcard)
        : 0;

    return {
      action: possibleActions.cancelSellOrder,
      data: o,
      utilityScore:
        baseUtilityScores.cancelSellOrder -
        pricePressureDownBoost +
        pricePressureUpBoost +
        highCashBoost,
    };
  });

  return [...buyOrderActions, ...sellOrderActions];
}

function getOneAction(actions) {
  const sortedByScore = actions.reduce((acc, action) => {
    const { utilityScore } = action;
    if (!(utilityScore in acc)) acc[utilityScore] = [];
    acc[utilityScore].push(action);
    return acc;
  }, {});
  const keyByHighestScore = Object.keys(sortedByScore).sort((a, b) => b - a);
  let topActions = [];

  for (let key of keyByHighestScore) {
    if (topActions.length > 5) break;
    topActions = [...topActions, ...sortedByScore[key]];
  }

  const action = getRandomValueFromArray(topActions);
  console.log(action);
  return action;
}

async function takeAction(action, user) {
  const { action: type } = action;

  switch (type) {
    case possibleActions.buyOrder:
      return completeOrder(action, user);

    case possibleActions.sellOrder:
      return completeOrder(action, user);

    case possibleActions.newBuyOrder:
      return createNewBuyOrder(action, user);

    case possibleActions.newSellOrder:
      return createNewSellOrder(action, user);

    case possibleActions.cancelBuyOrder:
      return cancelOrder(action, user);

    case possibleActions.cancelSellOrder:
      return cancelOrder(action, user);

    case possibleActions.doNothing:
      return {};

    default:
      throw new Error(
        `Could not take action, ${type} is not a valid action type.`
      );
  }
}

async function completeOrder(action, user) {
  const {
    data: { id: orderId },
  } = action;
  // const { data } = await axios.put(`${ORDER_SERVICE_URL}/order/complete`, {
  //   orderId,
  //   userCompletingOrder: user.pk,
  // });
  return data;
}

async function createNewBuyOrder(action, user) {
  console.log({ action });
  const {
    data: { pricePerShare, tickerSymbol, description, pk, name },
  } = action;
  const { cashOnHand } = user;
  const deviationFromPPS = 1 + getRandomFloat(-0.1, 0.1);
  const newPricePerShare = Math.round(deviationFromPPS * pricePerShare);
  const maxQuantity = Math.floor(cashOnHand / newPricePerShare);
  const quantity = getRandomIntZeroToX(maxQuantity);
  const stock = {
    tickerSymbol,
    description,
    pk,
    name,
  };
  const body = {
    orderType: 'buy',
    total: quantity * newPricePerShare,
    quantity,
    stock,
    userId: user.pk,
  };
  console.log('New buy order body: ', body);
  // const { data } = await axios.post(`${ORDER_SERVICE_URL}/order/create`, body);
  // return data;
  return {};
}

async function createNewSellOrder(action, user) {
  const {
    data: { pricePerShare, tickerSymbol, description, pk, name },
  } = action;
  const { stocks } = user;
  const deviationFromPPS = 1 + getRandomFloat(-0.1, 0.1);
  const newPricePerShare = Math.round(deviationFromPPS * pricePerShare);
  const maxQuantity = stocks[tickerSymbol].quantityOnHand;
  const quantity = getRandomIntZeroToX(maxQuantity);
  const stock = {
    tickerSymbol,
    description,
    pk,
    name,
  };
  const body = {
    orderType: 'sell',
    total: quantity * newPricePerShare,
    quantity,
    stock,
    userId: user.pk,
  };
  console.log('New sell order body: ', body);
  // const { data } = await axios.post(`${ORDER_SERVICE_URL}/order/create`, body);
  // return data;
  return {};
}

function cancelOrder() {
  //
}
