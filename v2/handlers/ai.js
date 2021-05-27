import { commonMiddleware } from '../utils/middleware';
import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { isEmpty } from '../utils/dataChecks';
import {
  createAi,
  getAiByPkSk,
  getMostRecentAiAction,
  getFirstOrLastAi,
} from '../db/ai';
import { getFirstItem } from '../db/shared';

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
  await getDataForUtilityScores();
}

async function getDataForUtilityScores() {
  const res = await getNextAiProfile();
  console.log(res);
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
