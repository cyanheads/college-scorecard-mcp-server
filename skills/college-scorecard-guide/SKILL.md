---
name: college-scorecard-guide
description: Use scorecard_* tools for college shortlists, program comparisons, and affordability research. Resolve campus and CIP identities, follow program continuation, and check pooled outcomes, price periods, and earnings populations before drawing conclusions.
license: Apache-2.0
metadata:
  author: "cyanheads"
  version: "1.0"
---

## Scope

Use College Scorecard for reported U.S. institution costs, admissions, completion, aid, and program outcomes. Self-hosted API-backed calls require SCORECARD_API_KEY; the public hosted server supplies its own key. Embedded CIP and field lookups make no API calls. Use reported cohort statistics as evidence for a shortlist, rather than treating them as an individual's aid offer or earnings forecast.

## Identifiers

Resolve school names with scorecard_search_schools and verify the returned campus name and location before retaining its UNITID. Program searches also return school IDs for follow-up. An OPEID6 identifies an outcome reporting group across campuses; preserve its leading zeros and do not substitute it for a UNITID.

Resolve a discipline with scorecard_lookup_cip, then select the canonical four-digit group and the intended credential. A descendant-name match still returns its four-digit group, not a six-digit specialization. Keep CIP and credential together when comparing programs; a school's predominant degree is not a program credential.

## Gates

1. **Establish coverage before claiming absence or a leader.** Follow returned continuation with the same selectors. Program search orders rows within a fetched school page, not across every matching institution. School totals are not program totals, and an empty page after local filtering does not establish that no programs match elsewhere.
2. **Match earnings populations and vintages.** Institution earnings cover federally aided undergraduate entrants working and not enrolled, regardless of completion. Program completion earnings and legacy highest-credential earnings are separate populations. Read the returned provenance for each series before comparing cohort, measurement years, or dollar bases; historical data-file years are not entry years, and values are not re-inflated.
3. **Check aggregation before comparing campuses.** Read metric_scope and ope6_id. Institution earnings, debt, and repayment pool at OPEID6; program earnings and debt pool within OPEID6, CIP, and credential. Shared values do not establish independent campus performance. Campus program awards are neither enrollment nor unique-student counts.
4. **Check price periods before ordering costs.** Tuition and attendance each carry their own academic-year or program-year basis. Do not rank unlike periods together or infer one cost's basis from the other. For value analysis, retain net_price_basis and data_notes, including any fallback from the requested income bracket and the combination of campus prices with pooled outcomes.
5. **Preserve unknowns.** Unavailable values do not establish zero, free tuition, or privacy suppression. Use the availability field for the particular earnings series; the legacy suppressed flag does not describe every completion series. A missing projected field is not proof that the field path is invalid.
6. **Keep comparison scope explicit.** Ranks describe the returned comparison set. Respect unranked pooled or mixed-period rows, and process unprocessed_ids separately before presenting a shortlist as fully compared. Ranks from separate calls are not a single combined ranking.

## Workflows

### Build a school shortlist

Discover campuses, verify their identities, and use scorecard_compare_schools for the question's relevant topic. For affordability, run scorecard_value_analysis on shortlisted campuses using the family's income when known. Present its source prices, price basis, ratios, and notes together; a ratio alone does not establish payback time or an individual return.

### Compare a field of study

Resolve CIP and credential first, then use scorecard_search_programs with the relevant school constraints. Prefer CIP discovery to a title substring when searching across institutions: program_name filters only the fetched school page and is ignored when a CIP is supplied. Follow next until the scoped search is exhausted, including continuations that advance the school page after draining its program rows.

Use completion_1yr_median for the current one-year comparison that drives program ordering and earnings filtering. Keep completion_4yr_median separate, and label earnings_1yr_median as the legacy highest-credential series. Check each series' availability and provenance instead of filling a missing completion value with the legacy value. Fetch shortlisted campuses with scorecard_get_school and their program detail with scorecard_get_programs.

### Retrieve a complete inventory or projection

For scorecard_get_programs, follow nextOffset until null. For scorecard_search_programs, follow next rather than advancing school pages yourself; shown counts returned program rows and schools_shown counts fetched schools. For scorecard_lookup_cip, continue from nextOffset when present or narrow the discipline before selecting a code.

The scorecard://programs/{id} resource returns the first program page in provider order. Follow its nextUri through scorecard://programs/{id}/page/{offset}/{limit} until null. Resource/provider order differs from the tools' completion-earnings order; do not reuse an offset between these retrieval paths.

For custom metrics, discover paths with scorecard_list_fields before projecting with scorecard_get_school. Use only fields marked sortable for school sorting. Projected program arrays retain provider positions; follow each school's program_pages continuation with the same fields and school identity, preserving sparse positions rather than joining independent arrays by their nonempty elements.
