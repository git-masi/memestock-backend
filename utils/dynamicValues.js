import { randomInt, randomUniform } from 'd3-random';

export function getRandomInt(min, max) {
  return randomInt(min, max)();
}

export function getRandomValueFromArray(arr) {
  if (!(arr instanceof Array)) return null;
  return arr[getRandomInt(0, arr.length)];
}

export function getRandomFloat(min, max) {
  return randomUniform(min, max)();
}

export function getRandomBoolean(probability = 0.5) {
  return probability > randomUniform(0, 1)();
}
