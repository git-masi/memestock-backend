import { commonMiddleware } from '../utils/middleware';
import {
  apiResponse,
  HttpError,
  httpMethods,
  methodRouter,
  pathRouter,
} from '../utils/http';
import { isEmpty } from '../utils/dataChecks';
import {
  createAi,
  getAiByPkSk,
  getMostRecentAiAction,
  getFirstOrLastAi,
  createAiAction,
} from '../db/ai';
import { getFirstItem, getItems } from '../db/shared';
import { getCompanies } from '../db/companies';
import {
  createOrder,
  fulfillOrder,
  getOrder,
  getRecentOrders,
  getRecentUserOrders,
  cancelOrder,
} from '../db/orders';
import { orderStatuses, orderTypes } from '../schema/orders';
import { pkPrefixes } from '../schema/pkPrefixes';
import { baseUtilityScores, possibleActions } from '../utils/ai';
import {
  getRandomInt,
  getRandomValueFromArray,
  getRandomFloat,
} from '../utils/dynamicValues';

export const handler = commonMiddleware(aiLambda);

async function aiLambda(event) {
  const methodRoutes = {
    [httpMethods.GET]: handleGetMethods,
    [httpMethods.POST]: handlePostMethods,
  };
  const router = methodRouter(methodRoutes);

  try {
    const result = await router(event);

    if (!result || isEmpty(result)) return apiResponse();

    return apiResponse({ body: result });
  } catch (error) {
    console.info(error);

    if (error instanceof HttpError) return apiResponse({ ...error });

    return apiResponse({
      statusCode: 500,
    });
  }
}

function handleGetMethods(event) {
  const paths = {
    '/ai/action': handleExecuteAction,
  };
  const router = pathRouter(paths);
  const result = router(event);

  return result;

  function handleExecuteAction() {
    return executeAiAction();
  }
}

function handlePostMethods(event) {
  const paths = {
    '/ai': handleCreateAi,
  };
  const router = pathRouter(paths);
  const result = router(event);

  return result;

  function handleCreateAi() {
    return createAi();
  }
}

export async function executeAiAction() {
  // data: { aiProfile, companies, openBuyOrders, openSellOrders, fulfilledOrders, userOrders }
  const data = await getDataForUtilityScores();
  console.info('data for aiAction', JSON.stringify(data));

  // userStockValues: {
  //    FRD: { currentPricePerShare, totalValueHeld },
  //    MEME: { currentPricePerShare, totalValueHeld },
  //    ...
  //    totalStockValue
  // }
  const userStockValues = getValueOfUserStocks(data.aiProfile, data.companies);

  const boosts = getBoosts(
    data.aiProfile,
    userStockValues,
    data.openBuyOrders,
    data.openSellOrders,
    data.fulfilledOrders
  );

  const actions = createActions(data, boosts);

  const aiAction = getOneAction();
  console.info(aiAction);

  await execute();

  return createAiAction(aiAction, data.aiProfile);

  function getOneAction() {
    const actionsSortedByUtilityScore = actions.sort(
      (a, b) => b.utilityScore - a.utilityScore
    );
    const result = getRandomValueFromArray(
      actionsSortedByUtilityScore.slice(0, 5)
    );

    return result;
  }

  function execute() {
    const { action: type, data: actionData } = aiAction;

    switch (type) {
      case possibleActions.fulfillBuyOrder:
        return fulfillOrder(
          actionData.sk,
          data.aiProfile.sk,
          createFulfillmentMessage()
        );

      case possibleActions.fulfillSellOrder:
        return fulfillOrder(
          actionData.sk,
          data.aiProfile.sk,
          createFulfillmentMessage()
        );

      case possibleActions.createBuyOrder:
        return createNewBuyOrder(actionData.company, data.aiProfile);

      case possibleActions.createSellOrder:
        return createNewSellOrder(actionData.company, data.aiProfile);

      case possibleActions.cancelBuyOrder:
        return cancelOrder(actionData.sk);

      case possibleActions.cancelSellOrder:
        return cancelOrder(actionData.sk);

      case possibleActions.doNothing:
        break;

      default:
        throw new Error(
          `Could not take action, ${type} is not a valid action type.`
        );
    }

    function createFulfillmentMessage() {
      const emoji = ['💩', '💰', '💸', '🤑', '🚀', '💎'];
      const messages = [
        'To the moon!',
        'HODL GANG!',
        'I like the stock!',
        "Mo' money mo' problems",
      ];
      return `${messages[getRandomValueFromArray(messages)]} ${
        emoji[getRandomValueFromArray(emoji)]
      }`;
    }
  }

  function createNewBuyOrder(company, user) {
    const { currentPricePerShare, tickerSymbol } = company;
    const { cashOnHand, sk: userSk } = user;
    const deviationFromPPS = 1 + getRandomFloat(-0.1, 0.1);
    const newPricePerShare = Math.round(
      deviationFromPPS * currentPricePerShare
    );
    const maxQuantity = Math.floor(cashOnHand / newPricePerShare);
    const quantity = maxQuantity > 1 ? getRandomInt(1, maxQuantity) : 1;

    return createOrder({
      user: userSk,
      orderType: orderTypes.buy,
      total: quantity * newPricePerShare,
      quantity,
      tickerSymbol,
    });
  }

  function createNewSellOrder(company, user) {
    const { currentPricePerShare, tickerSymbol } = company;
    const { stocks, sk: userSk } = user;
    const deviationFromPPS = 1 + getRandomFloat(-0.1, 0.1);
    const newPricePerShare = Math.round(
      deviationFromPPS * currentPricePerShare
    );
    const maxQuantity = stocks[tickerSymbol].quantityOnHand;
    const quantity = maxQuantity > 1 ? getRandomInt(1, maxQuantity) : 1;

    return createOrder({
      user: userSk,
      orderType: orderTypes.sell,
      total: quantity * newPricePerShare,
      quantity,
      tickerSymbol,
    });
  }
}

async function getDataForUtilityScores() {
  const numOrdersToGet = 20;
  const nextAiProfile = await getNextAiProfile();

  if (!nextAiProfile) return;

  const dataFetchResults = await Promise.all([
    getCompanies(),
    getRecentOrders(orderStatuses.open, orderTypes.buy, numOrdersToGet),
    getRecentOrders(orderStatuses.open, orderTypes.sell, numOrdersToGet),
    getRecentOrders(orderStatuses.fulfilled, orderTypes.sell, numOrdersToGet),
    getUserOrders(),
  ]);

  const [
    companies,
    openBuyOrders,
    openSellOrders,
    fulfilledOrders,
    userOrders,
  ] = dataFetchResults.map((res) => getItems(res));

  return {
    aiProfile: nextAiProfile,
    companies,
    openBuyOrders,
    openSellOrders,
    userOrders,
    fulfilledOrders,
  };

  // todo: refactor so this is a function in the orders db file
  async function getUserOrders() {
    const userOrders = await getRecentUserOrders(
      `${nextAiProfile.pk}#${nextAiProfile.sk}`,
      numOrdersToGet
    );

    const orders = await Promise.all(
      getItems(userOrders).map((uo) =>
        getOrder(uo.orderPkSk.replace(`${pkPrefixes.order}#`, ''))
      )
    );

    return { Items: orders.map((o) => o.Item) };
  }
}

async function getNextAiProfile() {
  const mostRecentAiAction = getFirstItem(await getMostRecentAiAction());

  if (mostRecentAiAction) {
    const {
      nextAi: { pk, sk },
    } = mostRecentAiAction;
    return getFirstItem(await getAiByPkSk(pk, sk));
  }

  return getFirstItem(await getFirstOrLastAi('first'));
}

function getValueOfUserStocks(user, companies) {
  const { stocks } = user;
  const companiesUserOwns = Object.keys(stocks);
  const init = { totalStockValue: 0 };
  const result = companiesUserOwns.reduce(companiesReducer, init);

  return result;

  function companiesReducer(acc, tickerSymbol) {
    const { currentPricePerShare } = companies.find(
      (company) => company.tickerSymbol === tickerSymbol
    );
    const totalValueHeld =
      currentPricePerShare * stocks[tickerSymbol].quantityHeld;

    acc[tickerSymbol] = {
      currentPricePerShare,
      totalValueHeld,
    };

    acc.totalStockValue += totalValueHeld;

    return acc;
  }
}

function getBoosts(
  aiProfile,
  userStockValues,
  openBuyOrders,
  openSellOrders,
  fulfilledOrders
) {
  const lowHighCashBoosts = getHighLowCashBoosts(
    aiProfile,
    userStockValues.totalStockValue
  );
  const mostFreqBoosts = calculateBoostForMostFrequentOrders(
    openBuyOrders,
    openSellOrders
  );
  const changeInPricePerShare = calculateChangeInPricePerShare(fulfilledOrders);
  const result = {
    ...lowHighCashBoosts,
    ...mostFreqBoosts,
    ...changeInPricePerShare,
  };
  return result;
}

function getHighLowCashBoosts(aiProfile, totalStockValue) {
  const wealthInCashVsStocks = aiProfile.totalCash / totalStockValue; // Infinity is all cash, 0 is all stocks
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

function calculateBoostForMostFrequentOrders(openBuyOrders, openSellOrders) {
  const result = {
    mostFreqBuy: getMostFrequentStock(openBuyOrders),
    mostFreqSell: getMostFrequentStock(openSellOrders),
  };

  return result;
}

function getMostFrequentStock(orders) {
  if (orders.length < 1) return '';
  const numPerStock = getNumOrdersPerStock();
  const entries = Object.entries(numPerStock);
  const sorted = entries.sort((entryA, entryB) => entryB[1] - entryA[1]);
  const firstEntry = sorted[0];
  const result = firstEntry[0];

  return result;

  function getNumOrdersPerStock() {
    const result = orders.reduce((acc, order) => {
      const symbol = order?.tickerSymbol;
      if (!(symbol in acc)) acc[symbol] = 0;
      acc[symbol] += 1;
      return acc;
    }, {});

    return result;
  }
}

function calculateChangeInPricePerShare(fulfilledOrders) {
  const sortedByStock = sortByStock();
  const result = calculatePriceChange(sortedByStock);

  return result;

  function sortByStock() {
    const result = fulfilledOrders.reduce((acc, order) => {
      const { tickerSymbol } = order;
      if (!(tickerSymbol in acc)) acc[tickerSymbol] = [];
      acc[tickerSymbol].push(order);
      return acc;
    }, {});

    return result;
  }

  function calculatePriceChange(orders) {
    const entries = Object.entries(orders);

    if (entries.length === 0) return {};

    const result = entries.reduce((acc, entry) => {
      const [tickerSymbol, transactions] = entry;
      const pps = transactions.map((t) => t.total / t.quantity);
      const priceChanges = pps.map((price, i) =>
        i === pps.length - 1 ? 0 : price - pps[i + 1]
      );
      const change = priceChanges.reduce(
        (sum, priceChange) => sum + priceChange
      );
      acc[tickerSymbol] = change; // cents
      return acc;
    }, {});

    return result;
  }
}

function createActions(data, boosts) {
  const fulfillOrderActions = createFulfillOrderActions(data, boosts);
  const newOrderActions = createNewOrderActions(data, boosts);
  const cancelOrderActions = createCancelOrderActions(data, boosts);
  const doNothing = {
    action: possibleActions.doNothing,
    data: {},
    utilityScore: baseUtilityScores.doNothing,
  };
  const result = [
    ...fulfillOrderActions,
    ...newOrderActions,
    ...cancelOrderActions,
    doNothing,
  ];

  return result;
}

function createFulfillOrderActions(data, boosts) {
  const {
    companies,
    aiProfile,
    openBuyOrders: buyOrders,
    openSellOrders: sellOrders,
  } = data;
  const fillableBuyOrders = getFillableBuyOrders();
  const possibleBuyOrderActions = fillableBuyOrders.map(mapFulfillBuyOrders);
  const fillableSellOrders = getFillableSellOrders();
  const possibleSellOrderActions = fillableSellOrders.map(mapFulfillSellOrders);

  return [...possibleBuyOrderActions, ...possibleSellOrderActions];

  function getFillableBuyOrders() {
    const notOwnOrders = filterOutUserOrders(buyOrders, aiProfile.sk);
    const result = notOwnOrders.filter(orderCanBeFilled);

    return result;

    function orderCanBeFilled(order) {
      const { tickerSymbol, quantity } = order;
      const hasStock = tickerSymbol in aiProfile.stocks;
      if (!hasStock) return false;
      return aiProfile.stocks[tickerSymbol].quantityOnHand >= quantity;
    }
  }

  function getFillableSellOrders() {
    const notOwnOrders = filterOutUserOrders(sellOrders, aiProfile.sk);
    const result = notOwnOrders.filter(orderCanBeFilled);

    return result;

    function orderCanBeFilled(order) {
      const { total } = order;
      return aiProfile.cashOnHand >= total * 1.5; // Ensure there is enough cash
    }
  }

  function mapFulfillBuyOrders(order) {
    const { tickerSymbol } = order;
    const company = companies.find((c) => c.tickerSymbol === tickerSymbol);
    const freqBoost = boosts.mostFreqBuy === tickerSymbol ? aiProfile.fomo : 0;
    const pricePressureBoost =
      tickerSymbol in boosts && boosts[tickerSymbol] > 0
        ? Math.ceil(
            (boosts[tickerSymbol] / company.currentPricePerShare) *
              ((aiProfile.fomo + aiProfile.wildcard) / 2)
          )
        : 0;
    const collectorBoost =
      tickerSymbol in aiProfile.stocks
        ? Math.ceil((aiProfile.collector + aiProfile.wildcard) / 2)
        : 0;
    const result = {
      action: possibleActions.fulfillBuyOrder,
      data: order,
      utilityScore:
        baseUtilityScores.fulfillBuyOrder +
        freqBoost +
        pricePressureBoost +
        collectorBoost +
        boosts.lowCashBoost,
    };

    return result;
  }

  function mapFulfillSellOrders(order) {
    const { tickerSymbol } = order;
    const company = companies.find((c) => c.tickerSymbol === tickerSymbol);
    const freqBoost =
      boosts.mostFreqSell === tickerSymbol ? aiProfile.lossAversion : 0;
    const pricePressureBoost =
      tickerSymbol in boosts && boosts[tickerSymbol] < 0
        ? Math.ceil(
            (boosts[tickerSymbol] / company.currentPricePerShare) *
              ((aiProfile.lossAversion + aiProfile.wildcard) / 2)
          )
        : 0;
    const result = {
      action: possibleActions.fulfillSellOrder,
      data: order,
      utilityScore:
        baseUtilityScores.fulfillSellOrder +
        freqBoost +
        pricePressureBoost +
        boosts.highCashBoost,
    };

    return result;
  }
}

function createNewOrderActions(data, boosts) {
  const {
    companies,
    aiProfile,
    openBuyOrders: buyOrders,
    openSellOrders: sellOrders,
  } = data;
  // todo: refactor this so that we don't have to filter out null values
  // possibly use the reduce method or filter out companies first
  const possibleBuyOrderActions = companies
    .map(mapCompaniesForBuyOrders)
    .filter((res) => res !== null);
  const possibleSellOrderActions = companies
    .map(mapCompaniesForSellOrders)
    .filter((res) => res !== null);
  const result = [...possibleBuyOrderActions, ...possibleSellOrderActions];

  return result;

  function mapCompaniesForBuyOrders(company) {
    const { tickerSymbol, currentPricePerShare } = company;

    if (currentPricePerShare * 0.8 > aiProfile.cashOnHand) return null; // if stock price too high return

    const freqBoost = boosts.mostFreqBuy === tickerSymbol ? aiProfile.fomo : 0;
    const pricePressureBoost =
      tickerSymbol in boosts && boosts[tickerSymbol] < 0 // want to buy if stock price is falling
        ? Math.ceil(
            (boosts[tickerSymbol] / currentPricePerShare) *
              ((aiProfile.fomo + aiProfile.wildcard) / 2)
          )
        : 0;
    const collectorBoost =
      tickerSymbol in aiProfile.stocks
        ? Math.ceil((aiProfile.collector + aiProfile.wildcard) / 2)
        : 0;
    const userOrders = filterOutNonUserOrders(buyOrders, aiProfile.sk);
    const existingOrdersDecrease = Math.ceil(
      userOrders.length * getRandomInt(0, aiProfile.wildcard)
    );
    const result = {
      action: possibleActions.createBuyOrder,
      data: { company, aiProfile },
      utilityScore:
        baseUtilityScores.createBuyOrder +
        freqBoost +
        pricePressureBoost +
        collectorBoost +
        boosts.highCashBoost -
        existingOrdersDecrease,
    };

    return result;
  }

  function mapCompaniesForSellOrders(company) {
    const { tickerSymbol, currentPricePerShare } = company;

    if (!(tickerSymbol in aiProfile.stocks)) return null; // if ai doesn't own stock return

    const freqBoost = boosts.mostFreqSell === tickerSymbol ? aiProfile.fomo : 0;
    const boostVal = Math.ceil(
      (boosts[tickerSymbol] / currentPricePerShare) *
        ((aiProfile.lossAversion + aiProfile.wildcard) / 2)
    );
    const pricePressureBoost =
      tickerSymbol in boosts && boosts[tickerSymbol] > 0 // want to sell if price is rising
        ? boostVal
        : 0;
    const lossAversionBoost =
      tickerSymbol in boosts && boosts[tickerSymbol] < 0 // want to sell if price is falling, fear of loss
        ? boostVal
        : 0;
    const randomBoost = getRandomValueFromArray([
      pricePressureBoost,
      lossAversionBoost,
    ]);
    const userOrders = filterOutNonUserOrders(sellOrders, aiProfile.sk);
    const existingOrdersDecrease = Math.ceil(
      userOrders.length * getRandomInt(0, aiProfile.wildcard)
    );
    const result = {
      action: possibleActions.createSellOrder,
      data: { company, aiProfile },
      utilityScore:
        baseUtilityScores.createSellOrder +
        freqBoost +
        randomBoost +
        boosts.lowCashBoost -
        existingOrdersDecrease,
    };

    return result;
  }
}

function createCancelOrderActions(data, boosts) {
  const { companies, aiProfile, userOrders } = data;
  const openOrders = userOrders.filter(
    (o) => o.orderStatus === orderStatuses.open
  );
  const buyOrders = filterByOrderType(openOrders, 'buy');
  const sellOrders = filterByOrderType(openOrders, 'sell');
  const buyOrderActions = buyOrders.reduce(reduceBuyOrders, []);
  const sellOrderActions = sellOrders.reduce(reduceSellOrders, []);
  const result = [...buyOrderActions, ...sellOrderActions];

  return result;

  function filterByOrderType(orders, type) {
    return orders.filter((order) => order?.orderType === type);
  }

  function reduceBuyOrders(acc, order) {
    const { pricePressureDownBoost, pricePressureUpBoost } =
      getPriceUpDownBoosts(order);

    const action = {
      action: possibleActions.cancelBuyOrder,
      data: order,
      utilityScore:
        baseUtilityScores.cancelBuyOrder +
        pricePressureUpBoost -
        pricePressureDownBoost +
        boosts.lowCashBoost,
    };

    return [...acc, action];
  }

  function reduceSellOrders(acc, order) {
    const { pricePressureDownBoost, pricePressureUpBoost } =
      getPriceUpDownBoosts(order);

    const action = {
      action: possibleActions.cancelSellOrder,
      data: order,
      utilityScore:
        baseUtilityScores.cancelSellOrder +
        pricePressureDownBoost -
        pricePressureUpBoost +
        boosts.highCashBoost,
    };

    return [...acc, action];
  }

  function getPriceUpDownBoosts(order) {
    const { tickerSymbol } = order;

    const { currentPricePerShare } = companies.find(
      (c) => c.tickerSymbol === tickerSymbol
    );

    const percentChange =
      tickerSymbol in boosts ? boosts[tickerSymbol] / currentPricePerShare : 0;

    // price is falling
    const pricePressureDownBoost =
      boosts[tickerSymbol] < 0
        ? Math.ceil(
            percentChange * ((aiProfile.lossAversion + aiProfile.wildcard) / 2)
          )
        : 0;

    // price is rising
    const pricePressureUpBoost =
      boosts[tickerSymbol] < 0
        ? Math.ceil(percentChange * ((aiProfile.fomo + aiProfile.wildcard) / 2))
        : 0;

    const result = { pricePressureDownBoost, pricePressureUpBoost };

    return result;
  }
}

function filterOutUserOrders(orders, sk) {
  const result = orders.filter(
    (o) => o.originatingUser !== `${pkPrefixes.user}#${sk}`
  );
  return result;
}

function filterOutNonUserOrders(orders, sk) {
  const result = orders.filter(
    (o) => o.originatingUser === `${pkPrefixes.user}#${sk}`
  );
  return result;
}
