# Piskent Invest AI — audit of auction-generated lot data (2026-11-18)

## Evidence in repository

- `parser.js` previously generated coordinates from `pageIndex` and `index`, creating arbitrary rectangles near Piskent rather than cadastral geometry.
- All **132 entries** in `public/scraped_plots.json` contain `area = 0.65`, `jobs = 14`, `power = "40 кВт"`, and an identical gas/water/road template. Coordinates follow a synthetic grid. This dataset is historical evidence, **not a verified map of parcels**.
- The previous price extraction read the first `.lot-attribute-div .lot-value`; therefore `budget` values must not be presented as authenticated prices.
- `public/fallback_plots.json` contains 8 separately maintained records. These are preserved untouched; their exact coordinates/ownership/technical values still require independent verification.
- Production plot data is served from Supabase `piskent_plots` via `/api/save-plots`. We have not performed a database-wide independent cross-check against cadastral/auction sources.

## Implemented controls

1. `parser.js` now writes candidate IDs, links, names and image URLs only to `data/auction-candidates.json`. Unknown area, price, jobs, utilities and geometry are explicitly null. On empty collection the parser fails rather than wiping the previous candidate list.
2. The daily GitHub workflow commits only `data/auction-candidates.json`. It **does not overwrite** `public/scraped_plots.json` or Supabase.
3. A read-only public API overlay matches known historic lot IDs **and exact auction URLs** and removes only fields that still equal the generated historical values. Manually corrected field values are retained.
4. Original Supabase rows are **never modified by the overlay**. The authenticated admin panel requests `?adminRaw=1`, avoiding accidental save of the masked public representation.
5. Unverified records carry `dataQuality: "needs_verification"`. Their fabricated geometry will not create map markers; public cards warn that verification is needed and suppress misleading investment scores.

## Important limitations / next steps

- Source provenance cannot be established by ID alone: manually edited values that exactly equal an old generated value remain ambiguous and may be masked publicly. This is reversible; the database remains unchanged.
- Prior generated polygons were not real cadastral boundaries. Display them again only after receiving a verified polygon or coordinates, with a source link and verification date.
- Verify each auction lot with its official detail page, including status, current price, and area; verify infrastructure and geolocation against authorized district technical data.
- Do not bulk-upsert `auction-candidates.json` into the production database. Manual confirmation and provenance fields should precede future automated imports.
- No historical JSON rows, manual fallback records, or Supabase rows were deleted as part of this change.

## Editorial criterion for investment-scale candidates

- Proposed minimum for **new land plot candidates**: **1.0 ha**, measured from an official source. This is a configurable editorial threshold, **not** a statutory rule or automatic proof of investor suitability.
- Verified new land plots **below** 1.0 ha are excluded from the incoming candidate review queue unless a strategic exception has been explicitly approved with a recorded official source.
- Verified new land plots **at or above** 1.0 ha advance to **human review**, not automatic publication. Project relevance, ownership, availability, cadastral boundaries, access, and utility availability still need verification.
- Missing/unverified area means **review required**, never an invented 0.65 ha or automatic rejection.
- Existing manually entered plots, buildings, industrial facilities, and mixed land/building investment objects are **not automatically removed** by this size policy.
- Likely kiosks, food stalls and similar micro-retail projects are flagged for an editor; names alone are not enough to reject an investment opportunity.
- The policy is implemented in `lib/investmentEligibility.cjs` and invoked for incoming parser candidates. It never runs a database mutation.
