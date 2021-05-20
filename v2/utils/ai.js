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
