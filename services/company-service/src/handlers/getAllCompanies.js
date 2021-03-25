// Modules
import { DynamoDB } from 'aws-sdk';

// Libs
import { commonMiddleware, successResponse } from 'libs';

// Utils
import { documentTypes } from '../utils/documentTypes';

const { COMPANIES_TABLE_NAME, GSI_DOCUMENT_TYPE } = process.env;
const dynamoDb = new DynamoDB.DocumentClient();

async function getAllCompanies(event) {
  try {
    const params = {
      TableName: COMPANIES_TABLE_NAME,
      IndexName: GSI_DOCUMENT_TYPE,
      KeyConditionExpression: '#documentType = :documentType',
      ExpressionAttributeNames: {
        '#documentType': 'documentType',
      },
      ExpressionAttributeValues: {
        ':documentType': documentTypes.record,
      },
    };

    const { Items } = await dynamoDb.query(params).promise();
    return successResponse(Items);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export const handler = commonMiddleware(getAllCompanies);
