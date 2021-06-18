export const pkPrefixes = Object.freeze({
  user: 'USER',
  displayName: 'DISPLAY_NAME',
  email: 'EMAIL',
  userOrder: 'USER_ORDER',
  order: 'ORDER',
  company: 'COMPANY',
  companyName: 'COMPANY_NAME',
  tickerSymbol: 'TICKER_SYMBOL',
  aiAction: 'AI_ACTION',
});

export function stripPk(pkSk) {
  if (typeof pkSk !== 'string') return null;

  const pkPrefixRegex = new RegExp(`(${Object.values(pkPrefixes).join('|')})#`);
  const result = pkSk.replace(pkPrefixRegex, '');

  return result;
}
