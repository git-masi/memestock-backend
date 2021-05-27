const baseChaoticRiskProfile = Object.freeze({
  fomo: 15,
  lossAversion: 0,
  collector: 5,
  wildcard: 20,
});

const baseConservativeRiskProfile = Object.freeze({
  fomo: 0,
  lossAversion: 25,
  collector: 10,
  wildcard: 5,
});

const baseAgressiveRiskProfile = Object.freeze({
  fomo: 20,
  lossAversion: 0,
  collector: 10,
  wildcard: 10,
});

export const baseAiProfiles = Object.freeze([
  baseChaoticRiskProfile,
  baseConservativeRiskProfile,
  baseAgressiveRiskProfile,
]);

export const possibleActions = Object.freeze({
  buyOrder: 'buyOrder',
  sellOrder: 'sellOrder',
  newBuyOrder: 'newBuyOrder',
  newSellOrder: 'newSellOrder',
  cancelBuyOrder: 'cancelBuyOrder',
  cancelSellOrder: 'cancelSellOrder',
  doNothing: 'doNothing',
});

export const baseUtilityScores = Object.freeze({
  [possibleActions.buyOrder]: 20,
  [possibleActions.sellOrder]: 20,
  [possibleActions.newBuyOrder]: 20,
  [possibleActions.newSellOrder]: 20,
  [possibleActions.cancelBuyOrder]: 20,
  [possibleActions.cancelSellOrder]: 20,
  [possibleActions.doNothing]: 10,
});
