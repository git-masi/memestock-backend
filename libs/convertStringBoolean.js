export function convertStringBoolean(str) {
  if (typeof str === 'boolean') return str;
  if (str === 'true') return true;
  if (str === 'false') return false;
  return null;
}
