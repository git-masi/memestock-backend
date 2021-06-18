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

export function getFirstItem(dbResult) {
  const { Items, Item } = dbResult;
  const result = Items?.[0] ?? Item ?? null;
  return result;
}

export function getItems(dbResult) {
  const { Items, Item } = dbResult;
  const result = Items ?? Item ?? null;
  return result;
}
