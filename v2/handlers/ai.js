import { commonMiddleware } from '../utils/middleware';
import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { isEmpty } from '../utils/dataChecks';
import {
  createAi,
  getAiByPkSk,
  getMostRecentAiAction,
  getFirstOrLastAi,
} from '../db/ai';
import { getFirstItem, getItems } from '../db/shared';
import { getCompanies } from '../db/companies';
import { getRecentOrders, getRecentUserOrders } from '../db/orders';

export const handler = commonMiddleware(handleAiGateway);

async function handleAiGateway(event) {
  try {
    // if (!validAiHttpEvent(event)) throw HttpError.BadRequest();
    const result = await route(event);
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

function route(event) {
  switch (event.httpMethod) {
    case httpMethods.POST:
      return createAi();

    case httpMethods.GET:
      return routeGetRequest(event);

    default:
      throw HttpError.BadRequest();
  }
}

function routeGetRequest(event) {
  switch (event.path) {
    case '/ai/action':
      return executeAiAction();

    default:
      throw HttpError.BadRequest();
  }
}

export async function executeAiAction() {
  // data: { aiProfile, companies, openBuyOrders, openSellOrders, userOrders }
  const data = await getDataForUtilityScores();

  // userStockValues: {
  //    FRD: { currentPricePerShare, totalValueHeld },
  //    MEME: { currentPricePerShare, totalValueHeld },
  //    ...
  //    totalStockValue
  // }
  const userStockValues = getValueOfUserStocks(data.aiProfile, data.companies);

  const boosts = getBoosts(data.aiProfile, userStockValues);

  // todo: delete
  console.log(boosts);
}

async function getDataForUtilityScores() {
  const numOrdersToGet = 20;
  const nextAiProfile = await getNextAiProfile();

  if (!nextAiProfile) return;

  const dataFetchResults = await Promise.all([
    getCompanies(),
    getRecentOrders('open', 'buy', numOrdersToGet),
    getRecentOrders('open', 'sell', numOrdersToGet),
    getRecentUserOrders(
      `${nextAiProfile.pk}#${nextAiProfile.sk}`,
      numOrdersToGet
    ),
  ]);

  const [companies, openBuyOrders, openSellOrders, userOrders] =
    dataFetchResults.map((res) => getItems(res));

  // todo: delete
  console.log(
    nextAiProfile,
    companies,
    openBuyOrders,
    openSellOrders,
    userOrders
  );

  return {
    aiProfile: nextAiProfile,
    companies,
    openBuyOrders,
    openSellOrders,
    userOrders,
  };
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

function getBoosts(aiProfile, userStockValues) {
  const lowHighCashBoosts = getHighLowCashBoosts(
    aiProfile,
    userStockValues.totalStockValue
  );
  // const mostFreqBoosts = calculateBoostForMostFrequentOrders(copy);
  // const changeInPricePerShare = calculateChangeInPricePerShare(copy);
  const result = { ...lowHighCashBoosts };
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
