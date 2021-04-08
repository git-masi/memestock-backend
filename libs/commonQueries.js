import { convertStringBoolean } from './convertStringBoolean';

const commonIndexNames = Object.freeze({
  statusAndCreated: 'statusAndCreated',
});

export function createStatusAndCreatedIndexParams(args) {
  const {
    tableName,
    status,
    limit = 10,
    compareTime = new Date().toISOString(),
    compareTimeOperator = '<=',
    orderAsc = true,
  } = args;

  const params = {
    TableName: tableName,
    IndexName: commonIndexNames.statusAndCreated,
    KeyConditionExpression: `#status = :status AND #created ${compareTimeOperator} :now`,
    ExpressionAttributeNames: {
      '#status': 'status',
      '#created': 'created',
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':now': compareTime,
    },
    Limit: limit,
    ScanIndexForward:
      typeof orderAsc === 'string' ? convertStringBoolean(orderAsc) : orderAsc,
  };

  return params;
}
