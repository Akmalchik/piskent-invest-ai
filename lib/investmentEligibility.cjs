/**
 * Editorial screening for NEW investment candidates only.
 *
 * 1 ha is a configurable editorial threshold, not a legal criterion.
 * Never infer area or allow automatically importing a candidate from scraped text.
 * Existing manually curated/Supabase records are not deleted or hidden by this module.
 */
const MIN_LAND_HECTARES = 1;

const LARGE_PROJECT_SECTORS = new Set([
  'manufacturing', 'industrial', 'logistics', 'agro-processing', 'tourism',
  'technology', 'industrial-building'
]);

function assessInvestmentCandidate(candidate) {
  const name = String(candidate.name || '');
  const kind = String(candidate.propertyType || 'land').toLowerCase();
  const value = candidate.areaHectares;
  const known = candidate.areaVerified === true
    && typeof value === 'number' && Number.isFinite(value) && value > 0;

  // A visible alert only; title keywords are not proof of land use or size.
  const likelyMicroRetail = /(?:\b(?:kiosk|hot.?dog|food.?truck|stall)\b|киоск|хот.?дог|ларёк|дўконча)/i.test(name);
  const approvedException = candidate.strategicReviewApproved === true
    && LARGE_PROJECT_SECTORS.has(candidate.investmentSector)
    && Boolean(candidate.reviewSource);

  if (known && kind === 'land' && value >= MIN_LAND_HECTARES) {
    return { decision: 'review', reason: 'size_passed_requires_source_and_location_check', minHectares: MIN_LAND_HECTARES };
  }

  if (known && kind === 'land' && value < MIN_LAND_HECTARES && !approvedException) {
    return { decision: 'exclude', reason: 'below_minimum_investment_area', minHectares: MIN_LAND_HECTARES };
  }

  if (approvedException) {
    return { decision: 'review', reason: 'strategic_exception_requires_final_approval', minHectares: MIN_LAND_HECTARES };
  }

  if (likelyMicroRetail) {
    return { decision: 'review', reason: 'likely_micro_retail', minHectares: MIN_LAND_HECTARES };
  }

  if (!known) {
    return { decision: 'review', reason: 'area_unverified', minHectares: MIN_LAND_HECTARES };
  }

  // Buildings and land+building are evaluated as projects, not by footprint alone.
  return { decision: 'review', reason: 'building_requires_investment_review', minHectares: MIN_LAND_HECTARES };
}

module.exports = { MIN_LAND_HECTARES, assessInvestmentCandidate };
