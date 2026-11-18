const test = require('node:test');
const assert = require('node:assert/strict');
const { assessInvestmentCandidate } = require('../lib/investmentEligibility.cjs');

test('verified land >= 1 ha enters review (not auto-publication)', () => {
  assert.deepEqual(assessInvestmentCandidate({ name: 'Sanoat maydoni', propertyType: 'land', areaHectares: 1.2, areaVerified: true }).decision, 'review');
});
test('verified small land is excluded from new candidates', () => {
  const result = assessInvestmentCandidate({ name: 'Small retail plot', propertyType: 'land', areaHectares: 0.12, areaVerified: true });
  assert.equal(result.decision, 'exclude');
  assert.equal(result.reason, 'below_minimum_investment_area');
});
test('unknown area is not falsely treated as small land', () => {
  assert.equal(assessInvestmentCandidate({ name: 'Land', propertyType: 'land', areaHectares: null, areaVerified: false }).reason, 'area_unverified');
});
test('large project exception must be manually approved and sourced', () => {
  assert.equal(assessInvestmentCandidate({ name: 'Manufacturing plant', propertyType: 'land', areaHectares: 0.5, areaVerified: true, investmentSector: 'manufacturing', strategicReviewApproved: true, reviewSource: 'official-document' }).decision, 'review');
  assert.equal(assessInvestmentCandidate({ name: 'Manufacturing plant', propertyType: 'land', areaHectares: 0.5, areaVerified: true, investmentSector: 'manufacturing' }).decision, 'exclude');
});
test('building evaluation remains separate from hectare minimum', () => {
  assert.equal(assessInvestmentCandidate({ name: 'Factory', propertyType: 'building', areaHectares: 0.2, areaVerified: true }).reason, 'building_requires_investment_review');
});
