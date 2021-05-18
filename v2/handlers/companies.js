import { DynamoDB } from 'aws-sdk';
import { apiResponse, HttpError, httpMethods } from '../utils/http';
import { commonMiddleware } from '../utils/middleware';
import { validCompaniesHttpEvent } from './companiesSchema';

const { MAIN_TABLE_NAME } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

export const handler = commonMiddleware(lambdaForCompanies);

async function lambdaForCompanies(event) {
  try {
    if (!validCompaniesHttpEvent(event)) throw HttpError.BadRequest();
    const result = await route(event);
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
    case httpMethods.GET:
      return getCompaniesFromHttpEvent(event);

    case httpMethods.POST:
      return createCompanyFromHttpEvent(event);

    default:
      throw HttpError.BadRequest();
  }
}

function getCompaniesFromHttpEvent() {
  return {};
}

function createCompanyFromHttpEvent(event) {
  const params = createCompanyParams(event);
  return dynamoDb.transactWrite(params).promise();
}

function createCompanyParams(event) {
  const {
    body: { name, tickerSymbol, description, pricePerShare },
  } = event;

  return {
    TransactItems: [
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          ConditionExpression: 'attribute_not_exists(pk)',
          Item: {
            pk: 'COMPANY',
            sk: tickerSymbol,
            name,
            tickerSymbol,
            description,
            pricePerShare,
          },
        },
      },
      {
        Put: guardItem('COMPANY_NAME', name),
      },
      {
        Put: guardItem('TICKER_SYMBOL', tickerSymbol),
      },
    ],
  };
}

// Used to prevent duplicate entries for an attribute
function guardItem(prefix, value) {
  return {
    TableName: MAIN_TABLE_NAME,
    ConditionExpression: 'attribute_not_exists(pk)',
    Item: {
      pk: `${prefix}#${value}`,
      sk: value,
    },
  };
}
