import type { MatcherInput } from '../src';

export const baseInput: MatcherInput = {
  sector: 'manufacturing',
  projectCostLakhs: 100,
  eligibleCapitalCostLakhs: 60,
  eligiblePlantMachineryLakhs: 60,
  requestedLoanLakhs: 65,
  district: 'Chennai',
  locationClass: 'urban',
  backwardBlock: false,
  firstGeneration: true,
  age: 30,
  specialCategory: 'none',
  fpoWilling: false,
  entityKind: 'proprietorship',
  enterpriseStage: 'new',
  enterpriseSize: 'small',
  educationLevel: 'degree',
  annualFamilyIncomeLakhs: 5,
  priorGovernmentCapitalSubsidy: false,
  repaidMudraTarun: false,
  udyamRegistered: true,
};

export const withInput = (overrides: Partial<MatcherInput>): MatcherInput => ({
  ...baseInput,
  ...overrides,
});
