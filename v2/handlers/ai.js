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
  const pricePerShareData = getPricePerShareOfUserStocks(
    data.aiProfile,
    data.companies
  );

  // todo: delete
  console.log(pricePerShareData);
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

function getPricePerShareOfUserStocks(user, companies) {
  const { stocks } = user;
  const companiesUserOwns = Object.keys(stocks);

  const result = companiesUserOwns.reduce((acc, tickerSymbol) => {
    const { currentPricePerShare } = companies.find(
      (company) => company.tickerSymbol === tickerSymbol
    );

    acc[tickerSymbol] = {
      currentPricePerShare,
      totalValueHeld: currentPricePerShare * stocks[tickerSymbol].quantityHeld,
    };

    return acc;
  }, {});

  return result;
}
