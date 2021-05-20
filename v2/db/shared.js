const { MAIN_TABLE_NAME } = process.env;

// Used to prevent duplicate entries for an attribute
export function guardItem(prefix, value) {
  return {
    TableName: MAIN_TABLE_NAME,
    ConditionExpression: 'attribute_not_exists(pk)',
    Item: {
      pk: `${prefix}#${value}`,
      sk: value,
    },
  };
}

export function getFirstItem(queryResult) {
  const { Items } = queryResult;
  const result = Items?.[0] ?? null;
  return result;
}
