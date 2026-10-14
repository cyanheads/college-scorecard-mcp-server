# College Scorecard MCP Server — Design

## MCP Surface

### Tools

| Name | Description | Key Inputs | Annotations |
|:-----|:------------|:-----------|:------------|
| `scorecard_search_schools` | Search institutions with optional single-sex filters and API sorting. Returns core identity and cost metrics. | `query`, `state`, `ownership`, `degree_level`, `size_range`, `acceptance_rate_range`, `zip`, `distance`, `cip_code`, `sort`, `men_only`, `women_only`, `per_page`, `page` | `readOnlyHint` |
| `scorecard_get_school` | Full institutional profile for one or more school IDs — costs, admissions, outcomes, aid, demographics, and completion rates. When multiple IDs are supplied, returns all profiles; for side-by-side comparison on a specific dimension, use `scorecard_compare_schools`. | `id` (string or array), `fields` | `readOnlyHint`, `idempotentHint` |
| `scorecard_compare_schools` | Side-by-side metric values and ordinal competition ranks for 2–5 schools; ties share a rank and unavailable values are unranked. | `ids`, `topic` | `readOnlyHint` |
| `scorecard_get_programs` | Field-of-study programs at one school: median earnings and cohort count 1 year after the highest credential, cumulative Stafford/Grad PLUS debt, and IPEDS award counts for the two pooled debt-cohort years. Institution-level 6/8/10-year earnings are available via `scorecard_get_earnings`. | `id`, `cip_code`, `min_earnings`, `credential_level` | `readOnlyHint` |
| `scorecard_search_programs` | Find programs by CIP code or keyword across institutions, ranked by earnings within the fetched school page. School filters apply upstream; minimum earnings filters programs locally without changing school totals. Returns school names and IDs alongside program metrics and provider credential identity; CIP and credential filters apply together before school pagination. | `cip_code`, `credential_level`, `program_name`, `state`, `ownership`, `max_net_price`, `min_earnings`, `max_debt`, `per_page`, `page` | `readOnlyHint` |
| `scorecard_get_earnings` | Earnings of federally aided undergraduate entrants working and not enrolled, regardless of completion: 6/8/10-year medians, 6/10-year percentiles, non-male/male 6-year medians, and per-metric availability/provenance. `years` selects data-file vintages. | `id`, `years` | `readOnlyHint`, `idempotentHint` |
| `scorecard_value_analysis` | Combines cost, debt, repayment progress, and earnings for one school, with derived ratios and source figures. `family_income` selects the applicable net price bracket. | `id`, `family_income` | `readOnlyHint` |
| `scorecard_lookup_cip` | Search for Classification of Instructional Programs (CIP) codes by keyword or partial name. Returns matching CIP codes with standard titles. Required before using CIP-based filters in `scorecard_search_programs` or `scorecard_get_programs` when the caller knows a program by name but not code. | `query` | `readOnlyHint`, `openWorldHint: false` |
| `scorecard_list_fields` | Search the Scorecard field catalog by keyword. Returns field paths, descriptions, types, and sort support. Use before passing custom `fields` to `scorecard_get_school`. | `query` | `readOnlyHint`, `openWorldHint: false` |

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

College Scorecard MCP Server wraps the U.S. Department of Education's College Scorecard API (`api.data.gov/ed/collegescorecard/v1`), which covers ~6,500 Title IV institutions and ~2,800 data fields spanning costs, outcomes, demographics, financial aid, and field-of-study earnings. The server surfaces the most decision-relevant slice of that data — program graduate earnings and institution entrant earnings, net price by income bracket, debt loads, and completion rates — via a tool surface designed for the questions people actually ask about colleges: "Is this school worth it?", "Which CS programs pay off?", "How do these schools compare?", "Find schools matching my criteria."

Program-level outcomes report median earnings of graduates working and not enrolled 1 year after their highest credential, by school, CIP code, and credential level. Program search ranks only the fetched school page, so callers paginate to inspect further institutions.

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
- School sorting forwards indexed API fields; program search orders the fetched page locally by earnings
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
| 1 | `GET /schools?id={id}&fields=...cost,aid,completion...` | Fetch tuition, net price by income bracket, median debt, 3-yr repayment rate, graduation rate |
| 2 | `GET /schools?id={id}&fields=...earnings...` | Fetch median + P25/P75 earnings at 6, 8, 10 years |
| — | Synthesize | Compute debt-to-earnings and net-price ratios using 6-year earnings; select applicable net price bracket if `family_income` provided; flag missing data |

Calls 1 and 2 run in parallel via `Promise.all`, each restricted to the requested school ID.

**Output fields:**
- `school_name`, `school_id` — for chaining
- `list_price` — full tuition + fees
- `net_price_overall`, `net_price_for_income`, `family_income`, `applicable_income_bracket` — source estimates and requested income/bracket, retained even when the bracket estimate is unavailable
- `effective_net_price`, `net_price_basis` — price used in the annual-earnings ratio and its basis (`income_bracket`, `overall`, or `unavailable`); notes disclose missing-bracket fallback
- `median_debt` — median debt at graduation
- `graduation_rate` — completion rate at 150% normal time
- `repayment_progress_3yr` — share of borrowers paying down principal 3 years after entering repayment
- `earnings_6yr_median`, `earnings_10yr_median` — institution-level, across all programs
- `debt_to_earnings_ratio` — `median_debt / earnings_6yr_median`
- `net_price_to_annual_earnings` — income-specific net price when available, otherwise overall net price, divided by median annual earnings measured 6 years after entry
- `data_notes` — flags any suppressed or null fields and what they mean

### `scorecard_compare_schools`

Returns structured comparison rows with metric values and ordinal ranks within the result set, plus a comparison summary. The ranks place each school's values within the selected group.

| # | Call | Purpose |
|:--|:-----|:--------|
| 1 | `GET /schools?id={ids,comma-separated}&fields=...topic-specific...` | Fetch topic-specific fields for all schools in one request |
| — | Normalize | Compute ordinal competition ranks from strictly better available values (1, 1, 3); summaries name co-leaders |

Topics and their field sets:
- `costs` — tuition in/out, net price by income bracket, median debt
- `admissions` — acceptance rate, SAT/ACT range, enrollment size
- `outcomes` — graduation rate, earnings at 6/10yr, loan repayment rate
- `aid` — Pell grant rate, federal loan rate, median debt, repayment rate

---

## Design Decisions

### `compare_schools` is not redundant with `get_school` multi-ID

`get_school` with an array returns profiles. `compare_schools` returns named metric rows with ordinal competition ranks within the requested set, metric-specific direction, and tied-leader summaries. Input order controls presentation; equal values share ranks and missing values receive no rank.

### `latest.*` shorthand vs. explicit year fields

Tools default to `latest.*`, whose provenance is per metric. Earnings `years` selects published data-file start years 1996–2025, including unavailable years; invalid years fail before fetching. `trend[].year` is a file vintage, not an entry year. Institution earnings describe federally aided undergraduate entrants working and not enrolled, regardless of completion.

`src/data/earnings-context.ts` transcribes the official Institution_Cohort_Map and Most_Recent_Inst_Cohort_Map. `current_context` and each trend `context` map metrics to verified `data_file_year`, academic `entry_cohorts`, calendar `measurement_years`, and `dollar_year`. Unknown metadata is omitted. Latest provenance is established from the official map, never calendar arithmetic, sample equality, or an extra fetch. Dollar bases differ by file vintage; values are not re-inflated. Refresh the embedded domain/table when the dictionary changes.

### Field pre-selection strategy

Each tool selects fields for its purpose, including institution earnings percentiles where available. `scorecard_get_school` exposes a `fields` override; the search tools use their fixed field sets. `scorecard_list_fields` supplies the field paths and descriptions for that override.

Custom school projections always fetch `id` and `school.name`, then return the requested values in `selected_fields` and response omissions in `absent_fields`. Nested program leaves retain the returned ancestor subtree under its provider key, preserving sparse elements and array alignment rather than inventing nulls or dropping rows. This preserves arbitrary JSON and distinguishes explicit null from absence without inventing unavailable unrequested metrics. Default profiles retain the curated mapper, including `school.minority_serving.historically_black` as a true/false/unknown flag.

### Input normalization and classified failures

Required IDs are positive safe integers. Base-10 strings accept whitespace, leading zeros, plus, decimal, and exponent forms only when they resolve to a positive safe integer; hexadecimal, nonfinite, fractional, zero, negative, and unsafe values are rejected. An empty profile batch retains semantic ValidationError with zero requests. State lists/case, four-digit CIP dots, sort direction case, and reversed range endpoints normalize without dropping meaningful filters. Optional blanks are unset; required catalog queries are nonblank. Each search echoes effective selectors in a replayable shape, including defaults and excluding selectors ignored by precedence.

`fetchWithTimeout` bounds the complete exchange, including the body, and composes caller cancellation; `withRetry` retains classified transient failures. HTTP 400/422 validation and 401/403 authentication fail once, while throttling, deadlines, and availability use distinct reasons and retry policy. Safe provider diagnostics survive; credentials and credential-bearing URLs do not. Each API consumer declares its own inline reason/recovery contracts; resource factories attach recovery and request correlation without changing successful sparse JSON.

### Empty collections and caps

Catalog totals are counted before slicing at serving caps (fields 100, CIP 50), with a 1,000 requested-limit ceiling. Exact-cap results are untruncated; overflow includes concrete narrowing selectors. Valid no-match catalog and per-school program queries succeed with empty collections. Missing institutions remain lookup errors. Search notices distinguish no upstream matches, exhausted pages, and populated pages emptied by local program filtering; school totals and continuation remain independent of flattened rows.

### `scorecard_search_programs` vs. `scorecard_get_programs`

Two distinct tools with different primary questions. `get_programs` is school-centric: "what programs does MIT offer, and what do their graduates earn?" `search_programs` is program-centric: "which schools in Washington have computer science programs with median earnings over $80k?" They have different primary keys, different filter sets (school-side filters only on `search_programs`), and different output shapes. Both include school IDs in output for chaining.

### Metric availability as structured output

`readMetric` preserves finite numbers, including zero, classifies null/absence as `unavailable`, and recognizes only explicit `PS` / `PrivacySuppressed` markers as `privacy_suppressed`. Unknown strings or shapes are provider contract failures (`ServiceUnavailable`, `api_error`) with provider retry/report recovery. No runtime CSV fetching supplies a cause.

Program rows expose `earnings_availability`, comparison cells expose `availability`, and earnings snapshots/trends expose per-metric availability maps. `suppressed` flags/counts require confirmed markers; `unavailable_count` covers program earnings of unknown cause. Earnings aggregate suppression requires every supported current metric to be explicitly suppressed. Both wire surfaces carry these states. Missing earnings sort after available numbers and never pass numeric filters.

### Sortable vs. non-sortable fields

School search forwards `sort` to the API without a local fallback. The catalog follows the dictionary's INDEX column; the API's derived `latest.cost.avg_net_price.overall` field is also verified to support ascending and descending sorting. Six-year earnings is not sortable. Program search sorts earnings within the fetched school page and applies `min_earnings` locally because the nested earnings field is not indexed. Totals and continuation remain school-level, before local filtering; continuation is computed from page metadata, not flattened program counts.

### Program populations and single-sex flags

Program debt uses `debt.staff_grad_plus.all.all_inst.median` to retain same-level borrowing at previously attended institutions. The matching earnings count is `earnings.highest.1_yr.working_not_enrolled.overall_count`. IPEDS awards come from `counts.ipeds_awards1` and `counts.ipeds_awards2`, separately named for the two years of the pooled debt cohort: summing them would not produce enrollment or a unique-student cohort. Tools omit unknown metrics; the programs resource returns null, and all preserve zero counts.

School `men_only` / `women_only` filters distinguish true (1), false (0), and omission (including unknown). Profiles preserve both known values as booleans and omit unknown flags.

### CIP and field catalog as embedded static data

Both lookups use embedded government reference data: 186 current NCES CIP 2020 four-digit groups and 78 field entries. CIP titles and two-digit families match the official CSV exactly. Verified six-digit descendant titles provide keyword aliases while results retain the canonical four-digit group. Deleted and moved-from rows are excluded; this remains a curated subset. Dotted/undotted code queries normalize equivalently. Offline tests fixture the official groups, families, and selected descendants.

---

## Known Limitations

- Earnings may be unavailable for many reasons; null and absence do not identify a privacy cause
- Program earnings are medians for graduates working and not enrolled 1 year after their highest credential; 10-year figures are institution-level only
- Field-of-study data trails institution data by ~2 academic years
- 1,000 requests/hour rate limit — `scorecard_search_programs` across all states can exhaust budget; callers should scope searches
- Geographic filtering requires U.S. zip codes
- The school `sort` parameter only works on indexed fields; unsupported expressions return an API error
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
