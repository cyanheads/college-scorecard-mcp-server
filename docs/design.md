# College Scorecard MCP Server — Design

## MCP Surface

### Tools

| Name | Description | Key Inputs | Annotations |
|:-----|:------------|:-----------|:------------|
| `scorecard_search_schools` | Search and filter institutions by name, location, type, size, and acceptance rate range. Returns a list with core identity and cost metrics. | `query`, `state`, `ownership`, `degree_level`, `size_range`, `acceptance_rate_range`, `zip`, `distance`, `cip_code`, `per_page`, `page` | `readOnlyHint` |
| `scorecard_get_school` | Full institutional profile for one or more school IDs — costs, admissions, outcomes, aid, demographics, and completion rates. When multiple IDs are supplied, returns all profiles; for side-by-side comparison on a specific dimension, use `scorecard_compare_schools`. | `id` (string or array), `fields` | `readOnlyHint`, `idempotentHint` |
| `scorecard_compare_schools` | Normalized side-by-side comparison of 2–5 schools on a named topic. Returns percentile-ranked rows and relative deltas within the result set — structured output an agent cannot reconstruct from raw profiles. | `ids`, `topic` | `readOnlyHint` |
| `scorecard_get_programs` | All field-of-study programs at one school: 1-year post-graduation earnings (P25/median/P75), debt at graduation, and enrollment figures. This is the primary source for program-level earnings — institution-level 6/8/10-year earnings are separate and available via `scorecard_get_earnings`. | `id`, `cip_code`, `min_earnings`, `credential_level` | `readOnlyHint` |
| `scorecard_search_programs` | Find programs by CIP code or keyword across all institutions, ranked by median earnings. Accepts school-side filters (state, ownership, max cost) to answer queries like "best CS programs in Washington under $30k." Returns school name, school ID, and unit ID alongside program metrics for follow-up chaining. | `cip_code`, `program_name`, `state`, `ownership`, `max_net_price`, `min_earnings`, `max_debt`, `per_page`, `page` | `readOnlyHint` |
| `scorecard_get_earnings` | Institution-level post-graduation earnings for one school — median and percentiles at 6, 8, and 10 years after entry, with optional gender breakdown. This reflects outcomes across all graduates, not broken down by program; for program-specific earnings, use `scorecard_get_programs`. | `id`, `years` | `readOnlyHint`, `idempotentHint` |
| `scorecard_value_analysis` | Workflow tool: parallel-fetches cost, debt, repayment, and earnings data for a school and computes ROI metrics the API doesn't pre-calculate — debt-to-earnings ratio, net price by income bracket, 3-year loan repayment rate, and how these compare to peer institutions. `family_income` narrows the net price to the applicable bracket. Returns a structured summary with all source figures alongside derived metrics. | `id`, `family_income` | `readOnlyHint` |
| `scorecard_lookup_cip` | Search for Classification of Instructional Programs (CIP) codes by keyword or partial name. Returns matching CIP codes with standard titles. Required before using CIP-based filters in `scorecard_search_programs` or `scorecard_get_programs` when the caller knows a program by name but not code. | `query` | `readOnlyHint`, `openWorldHint: false` |
| `scorecard_list_fields` | Search the Scorecard field catalog by keyword. Returns matching field paths, descriptions, data types, and whether the field supports sorting. Use before passing custom field paths to the `fields` parameter on search/get tools. | `query` | `readOnlyHint`, `openWorldHint: false` |

### Resources

| URI Template | Description | Pagination |
|:-------------|:------------|:-----------|
| `scorecard://school/{id}` | Institutional profile by unit ID — injectable context for school-specific conversations. | No |
| `scorecard://programs/{id}` | Program-level outcomes for a school. | No |

### Prompts

| Name | Description | Args |
|:-----|:------------|:-----|
| `scorecard_compare_prompt` | Structures a multi-school comparison analysis using Scorecard data. | `school_names`, `focus` (costs / outcomes / programs) |

---

## Overview

College Scorecard MCP Server wraps the U.S. Department of Education's College Scorecard API (`api.data.gov/ed/collegescorecard/v1`), which covers ~6,500 Title IV institutions and ~2,800 data fields spanning costs, outcomes, demographics, financial aid, and field-of-study earnings. The server surfaces the most decision-relevant slice of that data — primarily post-graduation earnings by program, net price by income bracket, debt loads, and completion rates — via a tool surface designed for the questions people actually ask about colleges: "Is this school worth it?", "Which CS programs pay off?", "How do these schools compare?", "Find schools matching my criteria."

The killer feature is **program-level post-graduation earnings**: actual median earnings 1 year after graduation for ~6,500 school × CIP code combinations — not self-reported surveys. This is data the College Scorecard is uniquely positioned to provide.

Target users: agents helping with college research, financial planning, career exploration, and higher education policy analysis.

---

## Requirements

- API key from api.data.gov (free registration, `SCORECARD_API_KEY` env var)
- Rate limit: 1,000 requests/hour per key — field selection is critical to staying within budget
- Data is read-only; no write operations exist
- ~6,500 institutions; data updated periodically (last updated March 2026)
- Field-of-study (program) data trails institution data by ~2 years due to earnings cohort lag
- Earnings data uses the `latest.*` shorthand for most recent cohort; individual year fields available for trend queries
- Some fields are sparsely populated (null is common — especially earnings at selective schools with small cohorts, due to FERPA suppression; surfaced as structured `suppressed: true` flag, not bare null)
- Only fields marked as INDEX in the data dictionary support sorting; the tool surface handles this transparently via post-fetch sorting where needed
- Batch ID lookup supported via comma-separated `id` param (up to 100 per page)
- Geographic filtering available via `zip` + `distance` (miles/km), U.S. zip codes only
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
| 1 | `GET /schools?id={id}&fields=...cost,aid,completion...` | Fetch tuition, net price by income bracket, median debt, 3-yr repayment rate, graduation rate |
| 2 | `GET /schools?id={id}&fields=...earnings...` | Fetch median + P25/P75 earnings at 6, 8, 10 years |
| — | Synthesize | Compute debt-to-earnings ratio (debt / 10-yr earnings), cost-to-first-year-earnings ratio; select applicable net price bracket if `family_income` provided; flag data suppression |

Calls 1 and 2 run in parallel via `Promise.all`. Both calls also fetch peer school identifiers (same `school.carnegie_basic` category, same `school.ownership`) to provide median comparison values.

**Output fields:**
- `school_name`, `school_id` — for chaining
- `list_price` — full tuition + fees
- `net_price` — average net price overall and by applicable income bracket
- `median_debt` — median debt at graduation
- `graduation_rate` — 4-year completion rate at 150% time
- `loan_repayment_rate_3yr` — 3-year repayment rate (share not in default or delinquency)
- `earnings_6yr_median`, `earnings_10yr_median` — institution-level, across all programs
- `debt_to_earnings_ratio` — `median_debt / earnings_6yr_median` (standard gainful-employment metric)
- `net_price_to_first_year_earnings` — `net_price / (earnings_6yr_median / 6)` 
- `peer_median_debt_to_earnings` — same ratio for similar schools
- `data_notes` — flags any suppressed or null fields and what they mean

### `scorecard_compare_schools`

Returns structured comparison rows, not raw profiles. The value over `get_school` with multiple IDs is the normalization: percentile ranks within the result set and relative deltas, which let a caller see "School A is in the 75th percentile for net price among these 4 schools" rather than having to compute that from raw numbers.

| # | Call | Purpose |
|:--|:-----|:--------|
| 1 | `GET /schools?id={ids,comma-separated}&fields=...topic-specific...` | Fetch topic-specific fields for all schools in one request |
| — | Normalize | Compute within-set percentile ranks and relative deltas |

Topics and their field sets:
- `costs` — tuition in/out, net price by income bracket, median debt
- `admissions` — acceptance rate, SAT/ACT range, enrollment size
- `outcomes` — graduation rate, earnings at 6/10yr, loan repayment rate
- `aid` — Pell grant rate, federal loan rate, median debt, repayment rate

---

## Design Decisions

### `compare_schools` is not redundant with `get_school` multi-ID

`get_school` with an array returns N raw profiles — useful when the agent needs to read the full data. `compare_schools` returns normalized rows with within-set percentile ranks and relative deltas that are structurally impossible to reconstruct from raw profiles without knowing which other schools are in the comparison set. The separation is about output shape, not field selection.

### `latest.*` shorthand vs. explicit year fields

Tools default to `latest.*` (most recent available cohort per field) for all current-state queries. `scorecard_get_earnings` accepts a `years` parameter for time-series analysis. This hides year-by-year variation across the dataset (different fields have different latest cohorts) from callers who don't need it.

### Field pre-selection strategy

Each tool pre-selects a curated set of ~10–20 fields appropriate to its purpose, including earnings percentiles (P25/P75, not just median) where relevant. The optional `fields` parameter on search and get tools allows callers to override this. `scorecard_list_fields` makes this escape hatch usable by exposing the field catalog — without it, `fields` would only work for callers with the API docs open.

### `scorecard_search_programs` vs. `scorecard_get_programs`

Two distinct tools with different primary questions. `get_programs` is school-centric: "what programs does MIT offer, and what do their graduates earn?" `search_programs` is program-centric: "which schools in Washington have computer science programs with median earnings over $80k?" They have different primary keys, different filter sets (school-side filters only on `search_programs`), and different output shapes. Both include school IDs in output for chaining.

### FERPA suppression as structured output

The API returns null for earnings at schools with small program cohorts (FERPA protection). Rather than letting null reach the LLM bare, all program and earnings tools include a `suppressed` boolean and `suppression_note` string when data is missing due to privacy protection. This prevents the LLM from hallucinating a value or misinterpreting absence as a data quality issue.

### Sortable vs. non-sortable fields

Not all fields support API-side `sort`. `scorecard_search_programs` sorts by earnings — but earnings fields may not be indexed. The service layer applies post-fetch sorting in those cases, documented so the implementation doesn't try and fail with an API error.

### CIP and field catalog as embedded static data

Both `scorecard_lookup_cip` and `scorecard_list_fields` serve from bundled JSON derived from public government sources. No API call required, no rate limit impact, no latency. The CIP taxonomy (~2,400 codes) and the field catalog (~2,800 entries) are stable between major Scorecard releases. Embedding them also means the server works offline for these lookups.

---

## Known Limitations

- Earnings data is unavailable for many school/program combinations with small cohorts (FERPA suppression) — this is structural and affects the most selective schools most severely
- Program-level earnings are 1-year-after-graduation median only; 10-year figures are institution-level only
- Field-of-study data trails institution data by ~2 academic years
- 1,000 requests/hour rate limit — `scorecard_search_programs` across all states can exhaust budget; callers should scope searches
- Geographic filtering requires U.S. zip codes
- The `sort` parameter only works on indexed fields; the service layer handles this via post-fetch ordering where needed
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
| `school.degrees_awarded.predominant` | 0–4 | 0=non-degree, 1=certificate, 2=associate's, 3=bachelor's, 4=graduate. |
| `{field}__range` | `low..high` | Numeric range filter. Open-ended: `1000..` or `..500`. |
| `{field}__not` | value | Inverted match (exclude records matching value). |
| `fields` | comma-list | Field selection — strongly recommended; full records can be 50KB+. |
| `per_page` | 1–100 | Records per page (default 20). |
| `page` | int | Zero-indexed page number. |
| `sort` | `field:asc|desc` | Sort on indexed fields only (integer, float, autocomplete, name types). |
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
  "code": "11.0701",
  "title": "Computer Science.",
  "earnings": { "highest": { "1_yr": { "overall_median_earnings": 85000 } } },
  "debt": { "median_debt": 22000 },
  "counts": { "ipeds_enrollment": 450 }
}
```

When filtering with `latest.programs.cip_4_digit.code=11.0701`, only matching programs are returned. Pass `all_programs_nested=true` to get all programs alongside a filtered subset.

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

### Rate Limits

1,000 requests/hour per API key. Use field selection to stay within budget — a full record is large. `scorecard_lookup_cip` and `scorecard_list_fields` make zero API calls (static embedded data).
