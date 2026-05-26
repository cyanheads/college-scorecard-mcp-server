# college-scorecard-mcp-server

College Scorecard — U.S. Department of Education data on every accredited institution: costs, outcomes, demographics, financial aid.

## API

- **Base**: `https://api.data.gov/ed/collegescorecard/v1/`
- **Auth**: API key (free, via api.data.gov registration)
- **Rate limits**: 1,000 requests/hour per key
- **Docs**: https://collegescorecard.ed.gov/data/documentation/

## Key data

- **Institutions**: ~6,500 Title IV schools — community colleges through research universities
- **Costs**: Tuition, fees, net price by income bracket, average debt at graduation
- **Outcomes**: Earnings after graduation (by program, cohort year), completion rates, transfer rates
- **Admissions**: Acceptance rate, SAT/ACT score distributions
- **Demographics**: Enrollment by race/ethnicity, gender, age, income level, first-generation status
- **Financial aid**: Pell Grant rates, federal loan rates, default rates
- **Programs**: Field-of-study level data (CIP codes) with earnings and debt outcomes

## Cross-domain value

| Chain to | Query |
|---|---|
| Census | School location → surrounding community demographics and income |
| BLS | Degree programs → occupational employment and wage data |
| Congress | Higher education legislation, student loan reform bills |
| OpenStates | State-level higher ed funding, in-state tuition policies |
| USAspending | Federal grants to institutions |
| Socrata | State/city education open data |

## Tool ideas

- `scorecard_search_schools` — find institutions by name, state, type, degree level
- `scorecard_get_school` — full institutional profile
- `scorecard_compare_schools` — side-by-side comparison on selected metrics
- `scorecard_get_programs` — field-of-study outcomes for an institution
- `scorecard_search_programs` — find programs by CIP code or name across schools
- `scorecard_get_earnings` — post-graduation earnings by school/program/cohort

## Licensing (audited 2026-05-25)

- **Status: Clear to host**
- US federal government data (Dept of Education) — public domain under 17 USC §105
- Free API key via api.data.gov registration
- No redistribution restriction on the data

## Notes

- Data dictionary is large (~2,800 fields) — tool design should surface the most useful fields and allow drilling into specifics
- Earnings data is the killer feature: actual median earnings by program, not self-reported surveys
- Program-level data (field_of_study endpoint) is newer and very rich
