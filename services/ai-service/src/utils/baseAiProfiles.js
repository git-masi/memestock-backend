export const baseChaoticRiskProfile = {
  fomo: 15,
  lossAversion: 0,
  collector: 5,
  wildcard: 20,
};

export const baseConservativeRiskProfile = {
  fomo: 0,
  lossAversion: 25,
  collector: 10,
  wildcard: 5,
};

export const baseAgressiveRiskProfile = {
  fomo: 20,
  lossAversion: 0,
  collector: 10,
  wildcard: 10,
};

export const baseAiProfiles = [
  baseChaoticRiskProfile,
  baseConservativeRiskProfile,
  baseAgressiveRiskProfile,
];
