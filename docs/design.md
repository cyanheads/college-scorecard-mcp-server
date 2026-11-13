# College Scorecard MCP Server — Design

## MCP Surface

### Tools

| Name | Description | Key Inputs | Annotations |
|:-----|:------------|:-----------|:------------|
| `scorecard_search_schools` | Search institutions with provider-side filters and API sorting. Returns core identity, operating certification, and cost metrics. | `query`, `state`, `ownership`, `degree_level`, `size_range`, `acceptance_rate_range`, `zip`, `distance`, `cip_code`, `sort`, `men_only`, `women_only`, `operating`, `hbcu`, `locale`, `max_net_price`, `min_completion_rate`, `per_page`, `page` | `readOnlyHint` |
| `scorecard_get_school` | Institutional profiles with costs, outcomes, scope, and optional raw projections. Serves the first 100 distinct IDs; reports missing and unprocessed IDs separately. | `id` (string or array), `fields`, `program_limit`, `program_offset` | `readOnlyHint`, `idempotentHint` |
| `scorecard_compare_schools` | Compare the first five distinct IDs from up to 1,000 raw inputs. Rank eligible prices and outcomes when at least two schools are found. | `ids`, `topic` | `readOnlyHint` |
| `scorecard_get_programs` | Paged completion-based one-/four-year and legacy highest-credential outcomes, debt, and campus awards, each with provenance. Current one-year completion earnings drive ordering and filters. | `id`, `cip_code`, `min_earnings`, `credential_level`, `limit`, `offset` | `readOnlyHint` |
| `scorecard_search_programs` | Find programs by CIP × credential or local title filter. School totals remain upstream counts; row continuation drains current matches before advancing the school page. | `cip_code`, `credential_level`, `program_name`, `state`, `ownership`, `max_net_price`, `min_earnings`, `max_debt`, `per_page`, `page`, `limit`, `offset` | `readOnlyHint` |
| `scorecard_get_earnings` | Earnings of federally aided undergraduate entrants working and not enrolled, regardless of completion: 6/8/10-year medians, 6/10-year percentiles, non-male/male 6-year medians, and per-metric availability/provenance. `years` selects data-file vintages. | `id`, `years` | `readOnlyHint`, `idempotentHint` |
| `scorecard_value_analysis` | Combines cost, debt, repayment progress, and earnings for one school, with derived ratios and source figures. `family_income` selects the applicable net price bracket. | `id`, `family_income` | `readOnlyHint` |
| `scorecard_lookup_cip` | Search all current CIP 2020 four-digit groups by code, title, family, or verified descendant alias before filtering programs. | `query`, `limit`, `offset` | `readOnlyHint`, `openWorldHint: false` |
| `scorecard_list_fields` | Search the Scorecard field catalog by keyword. Returns field paths, descriptions, types, and sort support. Use before passing custom `fields` to `scorecard_get_school`. | `query` | `readOnlyHint`, `openWorldHint: false` |

### Resources

| URI Template | Description | Pagination |
|:-------------|:------------|:-----------|
| `scorecard://school/{id}` | Institutional profile by unit ID — injectable context for school-specific conversations. | No |
| `scorecard://programs/{id}` | First program page in provider order. | Follow `nextUri` |
| `scorecard://programs/{id}/page/{offset}/{limit}` | Program continuation with full matching total and separate series provenance. | Zero-based offset, limit up to 100 |

### Prompts

| Name | Description | Args |
|:-----|:------------|:-----|
| `scorecard_compare_prompt` | Structures a multi-school comparison analysis using Scorecard data. | `school_names`, `focus` (costs / outcomes / programs) |

---

## Overview

`college-scorecard-mcp-server` wraps the U.S. Department of Education's College Scorecard API (`api.data.gov/ed/collegescorecard/v1`), which covers ~6,500 Title IV institutions and ~2,800 data fields spanning costs, outcomes, demographics, financial aid, and field-of-study earnings. The server surfaces the most decision-relevant slice of that data — program graduate earnings and institution entrant earnings, net price by income bracket, debt loads, and completion rates — via a tool surface designed for the questions people actually ask about colleges: "Is this school worth it?", "Which CS programs pay off?", "How do these schools compare?", "Find schools matching my criteria."

Program-level outcomes separate completion-based one-/four-year earnings from legacy highest-credential one-year earnings, with provenance for each population. Current one-year completion earnings drive filters and ordering within each fetched school page; callers follow row and school continuation to inspect the full scoped set.

Target users: agents helping with college research, financial planning, career exploration, and higher education policy analysis.

---

## Requirements

- API key from api.data.gov (free registration, `SCORECARD_API_KEY` env var)
- Rate limit: 1,000 requests/hour per key — field selection is critical to staying within budget
- Data is read-only; no write operations exist
- ~6,500 institutions; data updated periodically (last updated March 2026)
- Field-of-study (program) data trails institution data by ~2 years due to earnings cohort lag
- Earnings data uses the `latest.*` shorthand for most recent cohort; individual year fields available for trend queries
- Null/absent metrics are unavailable with unknown cause. Only explicit `PS` / `PrivacySuppressed` markers establish privacy suppression, without establishing its particular cause.
- School sorting forwards the sort expression to the API. Program search orders the fetched page locally by earnings.
- Batch ID lookup normalizes and deduplicates up to 1,000 raw elements, fetches the first 100 distinct IDs, and reports missing processed IDs separately from unchecked excess
- Geographic filtering accepts ZIP-only provider defaults, ZIP+4, and nonnegative bare/mi/km decimal radii; a meaningful distance requires ZIP
- Programs returned as nested array under school record; filtering by CIP code returns only matching programs unless `all_programs_nested=true` is passed
- `scorecard_lookup_cip` is served from an embedded CIP code taxonomy (static data, no API call required)
- `scorecard_list_fields` is served from an embedded field catalog derived from the data dictionary (static data, no API call required)

---

## Services

| Service | Wraps | Used By |
|:--------|:------|:--------|
| `ScorecardService` | College Scorecard API (`api.data.gov/ed/collegescorecard/v1`) | All tools except `scorecard_lookup_cip` and `scorecard_list_fields` |

---

## Config

| Env Var | Required | Description |
|:--------|:---------|:------------|
| `SCORECARD_API_KEY` | Yes | API key from api.data.gov (free registration at https://api.data.gov/signup) |

---

## Implementation Order

1. Config and server setup (`SCORECARD_API_KEY`)
2. Embedded data: CIP code taxonomy + field catalog (static JSON, bundled)
3. `ScorecardService` — fetch wrapper with retry, field selection, and pagination
4. `scorecard_lookup_cip` — static data tool, no service dependency
5. `scorecard_list_fields` — static data tool, no service dependency
6. `scorecard_search_schools` — primary discovery tool
7. `scorecard_get_school` — profile fetcher (single + batch IDs)
8. `scorecard_get_programs` — program outcomes for one school
9. `scorecard_get_earnings` — earnings time series
10. `scorecard_search_programs` — cross-institution program search
11. `scorecard_compare_schools` — normalized comparison table
12. `scorecard_value_analysis` — workflow tool
13. Resources and prompt

Each step is independently testable.

---

## Domain Mapping

| Noun | API fields prefix | Operations |
|:-----|:-----------------|:-----------|
| School (institution) | `school.*`, `latest.*` | search by name/filters, get by ID, batch get, geographic search, program-filtered search |
| Program (field of study) | `latest.programs.cip_4_digit.*` | list by school, filter by CIP code, search across schools, filter by earnings/debt |
| Earnings (institution-level) | `latest.earnings.*`, `{year}.earnings.*` | get snapshot with percentiles, get time series |
| Cost | `latest.cost.*`, `latest.aid.*` | included in school profile and value analysis |
| Admissions | `latest.admissions.*` | included in school profile and search filters |
| CIP codes | embedded taxonomy | keyword-to-code lookup (static) |
| Field catalog | embedded dictionary | keyword-to-field-path lookup (static) |

---

## Workflow Analysis

### `scorecard_value_analysis`

Answers "is this school worth it?" by combining data that otherwise requires two API round-trips and post-processing arithmetic the caller should not have to do.

| # | Call | Purpose |
|:--|:-----|:--------|
| 1 | `GET /schools?id={id}&fields=...cost,aid,completion,repayment...` | Fetch costs, debt, completion, operating certification, and repayment |
| 2 | `GET /schools?id={id}&fields=...earnings...` | Fetch median + P25/P75 earnings at 6, 8, 10 years |
| — | Synthesize | Compute debt-to-earnings and net-price ratios using 6-year earnings; select applicable net price bracket if `family_income` provided; flag missing data |

Calls 1 and 2 run in parallel via `Promise.all`, each restricted to the requested school ID.

**Output fields:**
- `school_name`, `school_id` — for chaining
- `list_price` — available academic-year tuition, otherwise program-year tuition, with `tuition_basis`; attendance selects its basis independently
- `net_price_overall`, `net_price_for_income`, `family_income`, `applicable_income_bracket` — source estimates, effective income, and applicable bracket, retained even when the bracket estimate is unavailable
- `effective_net_price`, `net_price_basis` — price used in the annual-earnings ratio and its basis (`income_bracket`, `overall`, or `unavailable`); notes disclose missing-bracket fallback
- `median_debt` — median debt at graduation
- `graduation_rate` — completion rate at 150% normal time
- `operating` — current operating certification when reported
- `repayment_progress_3yr` and `repayment_progress_3yr_context` — historical share of borrowers paying down principal three years after repayment entry, with publication status and vintage
- `borrower_repayment` — two- and four-year undergraduate federal Direct Loan status series with separate denominators and provenance
- `earnings_6yr_median`, `earnings_10yr_median` — institution-level, across all programs
- `debt_to_earnings_ratio` — `median_debt / earnings_6yr_median`
- `net_price_to_annual_earnings` — income-specific net price when available, otherwise overall net price, divided by median annual earnings measured 6 years after entry
- `data_notes` — flags any suppressed or null fields and what they mean

### `scorecard_compare_schools`

Returns comparison rows with reported values and availability. Eligible rows can include ranks and a leader summary for the result set.

| # | Call | Purpose |
|:--|:-----|:--------|
| 1 | `GET /schools?id={ids,comma-separated}&fields=...topic-specific...` | Fetch topic-specific fields for all schools in one request |
| — | Normalize | Compute ordinal competition ranks from strictly better available values (1, 1, 3); summaries name co-leaders |

Topics and their field sets:
- `costs` — effective tuition and attendance, academic-year and program-year prices, overall and income-bracket net prices, median debt
- `admissions` — acceptance rate, SAT/ACT range, enrollment size
- `outcomes` — graduation rate, earnings at 6/10yr, historical three-year repayment progress, median debt
- `aid` — Pell grant rate, federal loan rate, median debt, historical three-year repayment progress, overall net price

---

## Design Decisions

### Comparison ranks

`get_school` with an array returns profiles. `compare_schools` normalizes and deduplicates up to 1,000 raw IDs before selecting the first five. Missing processed IDs and untouched excess are separate. Eligible price, debt, completion, earnings, and repayment rows use competition ranks and tied-leader summaries. Admissions metrics and aid participation rates are descriptive and remain unranked. A single found school returns values without ranks or a leader summary. Missing values receive no rank.

Institution earnings, debt, and repayment pool at OPEID6. A repeated known OPEID6 leaves the entire pooled comparison row unranked, preventing repeated observations from appearing to be independent campus results. Campus completion retains ordinary ranks. Effective tuition and attendance each prefer available academic-year values, including zero, then program-year values; rows mixing periods remain unranked. Raw academic tuition and program prices stay separately named. Net-price income fallback is unchanged and never substitutes tuition.

### Repayment populations and vintage

`src/data/repayment-context.ts` records vintages from the Scorecard data dictionary. The discontinued declining-balance metric measures borrowers paying down principal. The three-year value comes from the 2016–17 file and covers FY2013–FY2014 repayment-entry cohorts measured in FY2016–FY2017. School profiles and value analysis attach context when that value is available. Outcomes and aid comparison rows include the same provenance.

Default school profiles and value analysis also return making progress, default, and paid in full, three of eight mutually exclusive statuses for OPEID6-pooled undergraduate federal Direct Loan borrowers. The two-year series comes from the 2019–20 file and covers AY2016–17 and AY2017–18 cohorts measured in 2018–19 and 2019–20. The four-year series comes from the 2020–21 file and covers AY2015–16 and AY2016–17 cohorts measured in 2019–20 and 2020–21. Each series uses its own cohort count when reported.

Decimal shares carry a numeric value and the reported text. Bins such as `0.15-0.19` and `<=0.05` carry the reported text only. Null, absence, and `NA` are unavailable. Explicit privacy markers retain their own availability state. Unsupported rates are unavailable with a notice and leave the rest of the profile usable. Comparison ranks use the historical declining-balance rate only.

### `latest.*` shorthand vs. explicit year fields

Tools default to `latest.*`, whose provenance is per metric. Earnings `years` selects published data-file start years 1996–2025, including unavailable years; invalid years fail before fetching. `trend[].year` is a file vintage, not an entry year. Institution earnings describe federally aided undergraduate entrants working and not enrolled, regardless of completion.

`src/data/earnings-context.ts` transcribes the official Institution_Cohort_Map and Most_Recent_Inst_Cohort_Map. `current_context` and each trend `context` map metrics to verified `data_file_year`, academic `entry_cohorts`, calendar `measurement_years`, and `dollar_year`. Unknown metadata is omitted. Current institution earnings use the 2022 file, measured in 2022/2023 and expressed in 2024 dollars. Latest provenance is established from the official map, never calendar arithmetic, sample equality, or a per-request fetch. Dollar bases differ by file vintage; values are not re-inflated. `bun run check:earnings-provenance` checks all supported latest cells and their historical 2022 counterparts during maintenance.

### Field pre-selection strategy

Each tool selects fields for its purpose, including institution earnings percentiles where available. `scorecard_get_school` exposes a `fields` override; the search tools use their fixed field sets. `scorecard_list_fields` supplies the field paths and descriptions for that override.

Custom school projections always fetch `id`, `school.name`, and `ope6_id`, then return requested values in `selected_fields` and response omissions in `absent_fields`. Nested program leaves retain their provider parent subtree. `program_limit`/`program_offset` slice contiguous provider positions without sorting or compacting sparse values; each school's `program_pages` identifies the parent, full total, and continuation. Arbitrary JSON and explicit null remain distinct from absence. Default profiles retain the curated mapper, including `school.minority_serving.historically_black` as a true/false/unknown flag.

### Input normalization and classified failures

Required IDs are positive safe integers. Base-10 strings accept whitespace, leading zeros, plus, decimal, and exponent forms only when they resolve to a positive safe integer; hexadecimal, nonfinite, fractional, zero, negative, and unsafe values are rejected. An empty profile batch retains semantic ValidationError with zero requests. State lists/case, four-digit CIP dots, sort direction case, and reversed range endpoints normalize without dropping meaningful filters. Optional blanks are unset; required catalog queries are nonblank. Each search echoes effective selectors in a replayable shape, including defaults and excluding selectors ignored by precedence.

Negative school and program `max_net_price`, program `max_debt`, and value-analysis `family_income` normalize to zero with a notice. Historical earnings years are deduplicated in caller order. CIP lookup maps six-digit codes to their four-digit group with a notice. Program selectors continue to accept four-digit codes.

`fetchWithTimeout` bounds the complete exchange, including the body, and composes caller cancellation; `withRetry` retains classified transient failures. HTTP 400/422 validation and 401/403 authentication fail once, while throttling, deadlines, and availability use distinct reasons and retry policy. Safe provider diagnostics survive; credentials and credential-bearing URLs do not. Each API consumer declares its own inline reason/recovery contracts; resource factories attach recovery and request correlation without changing successful sparse JSON.

### Empty collections and caps

Catalog totals are counted before slicing at serving caps (fields 100, CIP 50), with a 1,000 requested-limit ceiling. CIP offset paging exposes every match. Program tools default to 20 rows and cap at 100 with a 1,000 requested-limit ceiling; selectors and stable ordering precede slicing. Exact-final pages are untruncated. Empty collections succeed, while missing institutions remain lookup errors. Search keeps school `page`/`per_page`/`total` separate from program `offset`/`limit`/`shown`; `next` drains remaining rows before advancing to the next school page, including when local filters leave no rows. The default programs resource serves its first page and links subsequent pages through `scorecard://programs/{id}/page/{offset}/{limit}` in provider order.

### `scorecard_search_programs` vs. `scorecard_get_programs`

Two distinct tools with different primary questions. `get_programs` is school-centric: "what programs does MIT offer, and what do their graduates earn?" `search_programs` is program-centric: "which schools in Washington have computer science programs with median earnings over $80k?" They have different primary keys, different filter sets (school-side filters only on `search_programs`), and different output shapes. Both include school IDs in output for chaining.

### Metric availability as structured output

`readMetric` preserves finite numbers, including zero, classifies null/absence as `unavailable`, and recognizes only explicit `PS` / `PrivacySuppressed` markers as `privacy_suppressed`. Unknown strings or shapes are provider contract failures (`ServiceUnavailable`, `api_error`) with provider retry/report recovery. No runtime CSV fetching supplies a cause.

Program rows expose `earnings_availability`, comparison cells expose `availability`, and earnings snapshots/trends expose per-metric availability maps. `suppressed` flags/counts require confirmed markers; `unavailable_count` covers program earnings of unknown cause. Earnings aggregate suppression requires every supported current metric to be explicitly suppressed. Both wire surfaces carry these states. Missing earnings sort after available numbers and never pass numeric filters.

### Sortable vs. non-sortable fields

School search forwards `sort` to the API without a local fallback. The catalog records observed sort support, which can differ from the dictionary's INDEX column. Overall average net price supports sorting. Income-bracket prices, six-year earnings, and pooled full-time retention are available for projection without sort support. Four-year retention covers first-time, full-time bachelor's or equivalent degree seekers. Less-than-four-year retention covers first-time, full-time degree or certificate seekers. Both measure return the next fall.

Program search sorts current one-year completion earnings within the fetched school page and applies `min_earnings` locally. School totals remain upstream counts before local filtering. Program totals and row offsets describe the current school page.

### Program populations

Program debt uses `debt.staff_grad_plus.all.all_inst.median` to retain same-level borrowing at previously attended institutions. Legacy `earnings_1yr_median` and `earnings_count` retain the highest-credential series. Additive `completion_1yr_*` and `completion_4yr_*` fields use their own working/not-enrolled counts and availability. Missing current earnings never fall back to legacy earnings. `src/data/program-provenance.ts` records separate cohorts, measurement years, dollar bases, and dictionary cells for each series, debt, and campus awards. Earnings/debt pool at OPEID6 within CIP and credential; IPEDS awards are campus counts, not enrollment or unique students. Existing nullable resource scalars remain nullable; all paths preserve zero.

Program tool text leads with the two completion series, then presents legacy earnings separately. It carries the same scope, provenance, availability, and continuation as the structured result.

### School discovery and certification

`operating`, `hbcu`, `men_only`, and `women_only` forward true as 1 and false as 0. Omission leaves unknown records eligible. The API applies these flags and the inclusive price and completion bounds before pagination. Locale groups use provider ranges 11–13 (city), 21–23 (suburb), 31–33 (town), and 41–43 (rural). Threshold and locale filters require reported values.

Default search rows, profiles, comparisons, value analysis, and the school resource expose operating certification as a boolean when reported. False indicates a lack of current certification. Actual closure requires separate verification. Custom projections preserve the raw provider value.

### CIP and field catalog as embedded static data

Both lookups use embedded government reference data: all 464 current NCES CIP 2020 four-digit groups and 94 selected field entries. CIP titles and two-digit families match the official CSV exactly. Verified six-digit descendant titles provide keyword aliases while results retain the canonical four-digit group. Deleted and moved-from rows are excluded. Dotted/undotted code queries normalize equivalently. Offline tests fixture the official groups, families, and selected descendants.

---

## Known Limitations

- Earnings may be unavailable for many reasons; null and absence do not identify a privacy cause
- Program earnings distinguish one-/four-year completion populations from legacy highest-credential one-year outcomes; 10-year figures are institution-level only
- Field-of-study data trails institution data by ~2 academic years
- 1,000 requests/hour rate limit — `scorecard_search_programs` across all states can exhaust budget; callers should scope searches
- Geographic filtering requires U.S. zip codes
- Unsupported school sort expressions return an API error
- No historical cost or admissions trends — the API has annual snapshots but trend queries would require multiple API calls; not in scope for v1

---

## API Reference

### Endpoint

```
GET https://api.data.gov/ed/collegescorecard/v1/schools
```

All external operations use this single endpoint. Program data is nested under school records (no separate field-of-study endpoint).

### Key Query Parameters

| Parameter | Type | Description |
|:----------|:-----|:------------|
| `api_key` | string | Required. From api.data.gov. |
| `id` | int or comma-list | Filter by unit ID(s). Comma-separated for batch. |
| `school.name` | string | Full-text word match (autocomplete field). All words must appear. |
| `school.state` | string | Two-letter state code. |
| `school.ownership` | 1, 2, 3 | 1=public, 2=private nonprofit, 3=private for-profit. |
| `school.degrees_awarded.predominant` | 0–4 | 0=not classified, 1=certificate, 2=associate's, 3=bachelor's, 4=entirely graduate-degree granting. |
| `{field}__range` | `low..high` | Numeric range filter. Open-ended: `1000..` or `..500`. |
| `{field}__not` | value | Inverted match (exclude records matching value). |
| `fields` | comma-list | Field selection — strongly recommended; full records can be 50KB+. |
| `per_page` | 1–100 | Records per page (default 20). |
| `page` | int | Zero-indexed page number. |
| `sort` | `field:asc\|desc` | Sort on a field with API sort support. |
| `zip` | US zip | Geographic center for distance filter. |
| `distance` | `{n}mi` or `{n}km` | Radius around zip code center. |
| `all_programs_nested` | bool | Return all program objects, not just those matching a program filter. |
| `latest.*` | wildcard | Shorthand for most recent year's data for a given field path. |

### Field Naming Convention

```
{year}.{category}.{subcategory}.{metric}
latest.{category}.{subcategory}.{metric}   ← most recent cohort
```

Examples:
- `latest.cost.tuition.in_state` — most recent in-state tuition
- `latest.earnings.10_yrs_after_entry.median` — institution-level 10-year earnings
- `latest.programs.cip_4_digit.earnings.highest.1_yr.overall_median_earnings` — program-level 1-year earnings

### Nested Program Data

Programs are returned as an array under `{year}.programs.cip_4_digit`. Each array element has:

```json
{
  "code": "1107",
  "title": "Computer Science.",
  "credential": { "level": 3, "title": "Bachelor's Degree" },
  "earnings": { "highest": { "1_yr": { "overall_median_earnings": 85000, "working_not_enrolled": { "overall_count": 200 } } } },
  "debt": { "staff_grad_plus": { "all": { "all_inst": { "median": 22000 } } } },
  "counts": { "ipeds_awards1": 450, "ipeds_awards2": 460 }
}
```

When filtering with `latest.programs.cip_4_digit.code=1107`, only matching programs are returned. The tools accept dotted `11.07` and undotted `1107`. Per-school program fetches use only the school ID upstream and filter locally, preserving the distinction between a missing school and a school with no matching program.

### CIP Code Structure

4-digit codes group related programs (first 2 digits = 2-digit family):
- `11.07` — Computer Science
- `51.*` — Health Professions (51.38 = Nursing, 51.12 = Medicine)
- `52.*` — Business (52.02 = Business Administration)
- `14.*` — Engineering
- `13.*` — Education

### Response Shape

```json
{
  "metadata": { "total": 6322, "page": 0, "per_page": 20 },
  "results": [
    { "id": 166683, "school.name": "...", "latest.cost.tuition.in_state": 60156 }
  ]
}
```

Error response: `{ "error": { "code": "...", "message": "..." } }`. Field-level errors: `{ "errors": [{ "error": "field_not_found", "input": "...", "message": "..." }] }`.

Provider HTTP 409 uses `api_conflict` on tools and resources. Tools retain Conflict (-32002); resource contracts declare InvalidParams (-32602), because the installed SDK wire codec remaps top-level -32002 errors. The reason, provider status, recovery, and request ID remain available.

### Rate Limits

1,000 requests/hour per API key. Use field selection to stay within budget — a full record is large. `scorecard_lookup_cip` and `scorecard_list_fields` make zero API calls (static embedded data).
