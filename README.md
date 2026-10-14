<div align="center">
  <h1>@cyanheads/college-scorecard-mcp-server</h1>
  <p><b>Search, compare, and analyze U.S. college data — costs, earnings, programs, and outcomes — via MCP. STDIO or Streamable HTTP.</b>
  <div>9 Tools • 2 Resources • 1 Prompt</div>
  </p>
</div>

<div align="center">

[![Version](https://img.shields.io/badge/Version-0.3.0-blue.svg?style=flat-square)](./CHANGELOG.md) [![License](https://img.shields.io/badge/License-Apache%202.0-orange.svg?style=flat-square)](./LICENSE) [![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/users/cyanheads/packages/container/package/college-scorecard-mcp-server) [![MCP SDK](https://img.shields.io/badge/MCP%20SDK-^2.3.1-green.svg?style=flat-square)](https://modelcontextprotocol.io/) [![npm](https://img.shields.io/npm/v/@cyanheads/college-scorecard-mcp-server?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/@cyanheads/college-scorecard-mcp-server) [![TypeScript](https://img.shields.io/badge/TypeScript-^7.0.2-3178C6.svg?style=flat-square)](https://www.typescriptlang.org/) [![Bun](https://img.shields.io/badge/Bun-v1.4.3-blueviolet.svg?style=flat-square)](https://bun.sh/)

</div>

<div align="center">

[![Install in Claude Desktop](https://img.shields.io/badge/Install_in-Claude_Desktop-D97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://github.com/cyanheads/college-scorecard-mcp-server/releases/latest/download/college-scorecard-mcp-server.mcpb) [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=college-scorecard-mcp-server&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBjeWFuaGVhZHMvY29sbGVnZS1zY29yZWNhcmQtbWNwLXNlcnZlciJdLCJlbnYiOnsiU0NPUkVDQVJEX0FQSV9LRVkiOiJ5b3VyLWFwaS1rZXkifX0=) [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect?url=vscode:mcp/install?%7B%22name%22%3A%22college-scorecard-mcp-server%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40cyanheads%2Fcollege-scorecard-mcp-server%22%5D%2C%22env%22%3A%7B%22SCORECARD_API_KEY%22%3A%22your-api-key%22%7D%7D)

[![Framework](https://img.shields.io/badge/Built%20on-@cyanheads/mcp--ts--core-67E8F9?style=flat-square)](https://www.npmjs.com/package/@cyanheads/mcp-ts-core)

</div>

<div align="center">

**Public Hosted Server:** [https://college-scorecard.caseyjhand.com/mcp](https://college-scorecard.caseyjhand.com/mcp)

</div>

---

## Overview

U.S. college data from the Department of Education College Scorecard API — costs, earnings, programs, and outcomes across roughly 6,500 Title IV institutions. Search and compare schools, look up program-level earnings by field of study, and compute ROI metrics like debt-to-earnings ratio from any MCP client. Runs as a stdio process, a local Streamable HTTP server, or the public hosted endpoint above.

### Tools

| Tool | Description |
|:---|:---|
| `scorecard_search_schools` | Search institutions by name, location, type, size, acceptance rate, and single-sex flags; sort by supported API fields. Returns core identity and cost metrics. |
| `scorecard_get_school` | Full institutional profiles — costs, admissions, outcomes, aid, demographics, single-sex flags, and completion rates. |
| `scorecard_compare_schools` | Normalized side-by-side comparison of 2–5 schools on a named topic. Returns metric values, ordinal ranks, and a comparison summary. |
| `scorecard_get_programs` | Field-of-study programs at one school: median 1-year earnings, cumulative Stafford/Grad PLUS debt, and IPEDS awards in the two pooled debt-cohort years. |
| `scorecard_search_programs` | Find programs by CIP and credential or keyword, retain degree identity, and rank earnings within each fetched school page. |
| `scorecard_get_earnings` | Earnings of federally aided undergraduate entrants working and not enrolled, regardless of completion: 6/8/10-year medians, 6/10-year P25/P75, and non-male/male 6-year medians. |
| `scorecard_value_analysis` | Workflow tool: parallel-fetches cost, debt, repayment, and earnings data, then computes ROI metrics — debt-to-earnings ratio and net price to earnings ratio. |
| `scorecard_lookup_cip` | Search 186 curated NCES CIP 2020 four-digit groups by code, keyword, or verified descendant alias. Served offline. |
| `scorecard_list_fields` | Search the Scorecard field catalog by keyword. Returns matching field paths, descriptions, data types, and sort support. Use before passing custom `fields` parameters. |

### Resources

| Resource | Description |
|:---|:---|
| `scorecard://school/{id}` | Institutional profile by unit ID — injectable context for school-specific conversations |
| `scorecard://programs/{id}` | Program-level outcomes for a school |

All resource data is also reachable via tools. Use `scorecard_search_schools` or `scorecard_get_school` to discover school IDs before constructing resource URIs.

### Prompts

| Prompt | Description |
|:---|:---|
| `scorecard_compare_prompt` | Structures a multi-school comparison analysis using Scorecard data |

## Capability reference

### `scorecard_search_schools` <sub>tool</sub>

- Search by name, state, ownership, degree level, size, acceptance rate, CIP code, or ZIP and distance; `per_page` is capped at 100 with zero-indexed `page`. State lists accept `WA,CA` and case variants. ZIP-only queries use the provider default radius; ZIP+4 and nonnegative decimal radii (bare miles, `mi`, or `km`) are supported. Reversed range bounds normalize to ascending order.
- Returns core identity and cost metrics for quick scanning.
- `sort` forwards a supported API expression such as `latest.cost.avg_net_price.overall:asc` (`:desc` reverses it). `men_only` and `women_only` accept true or false; omission includes unknown flags, while false selects only explicit zero values.

---

### `scorecard_get_school` <sub>tool</sub>

- Accepts a positive safe integer school ID or an array of up to 1,000 elements. Base-10 strings accept whitespace, leading zeros, plus, decimal, and exponent forms when they resolve to a positive safe integer. IDs are deduplicated before the first 100 distinct IDs are fetched; `missing_ids` identifies processed IDs without records, and `unprocessed_ids` identifies unchecked excess.
- Default profiles cover costs, admissions, outcomes, financial aid, demographics, and completion rates. Custom `fields` returns real ID/name plus `selected_fields` containing requested JSON values, including null, zero, false, and nested arrays. Program leaf projections retain the provider's parent subtree under `latest.programs.cip_4_digit`, preserving sparse rows and array positions; `absent_fields` lists requested paths omitted from that response. Unrequested profile metrics are omitted.
- HBCU status reads `school.minority_serving.historically_black`; HBCU and single-sex flags preserve true/false when known and remain unknown when absent/null.

---

### `scorecard_compare_schools` <sub>tool</sub>

- Accepts 2–5 school unit IDs and one topic: `costs`, `admissions`, `outcomes`, or `aid`.
- Returns metric values and competition ranks from one API call: equal values share a rank (1, 1, 3), unavailable values are unranked, and summaries name tied leaders. Each cell's `availability` distinguishes available, unavailable with unknown cause, and confirmed privacy suppression.

---

### `scorecard_get_programs` <sub>tool</sub>

- Accepts one school ID, with optional CIP code, `credential_level`, and minimum earnings filters.
- Existing schools with no reported or matching programs return a successful empty collection; a nonexistent school remains a lookup error. Dotted and undotted four-digit CIP codes are equivalent.
- Returns median earnings and the matching count of graduates working and not enrolled 1 year after their highest credential. `earnings_availability` is `available`, `unavailable`, or `privacy_suppressed`; zero is available, null/absence has unknown cause, and only explicit provider privacy markers set `suppressed`. `suppressed_count` and `unavailable_count` distinguish those populations.
- `median_debt` is completers' cumulative Stafford/Grad PLUS borrowing across attended institutions at the same academic level. `ipeds_awards_year1` and `ipeds_awards_year2` count awards in each year of the pooled debt cohort, not enrollment or unique students.

---

### `scorecard_search_programs` <sub>tool</sub>

- Search by CIP code or program name, with optional integer `credential_level`, state, ownership, net price, earnings, and debt filters; zero-indexed `page` and `per_page` (up to 100) paginate schools, so returned program rows may exceed `per_page`. CIP and credential selectors apply together upstream before pagination; credential codes are 1–8 and 99, and unknown integer selectors may return no matches.
- Returns school IDs and names alongside program metrics and provider `credential_level` / `credential_title`, retaining separate credentials and future numeric credential levels; missing identity fields stay absent. Available earnings sort first; availability states and counts have the same meaning as in `scorecard_get_programs`.
- `min_earnings` filters locally; totals and pagination remain upstream school counts before local filtering. Earnings/debt thresholds are inclusive and exclude unknown values. Debt and award fields have the same meanings as in `scorecard_get_programs`.

---

### `scorecard_get_earnings` <sub>tool</sub>

- Accepts one school ID and optional API data-file start `years` from 1996–2025. These are file vintages, not entry years; valid files without observations succeed. Omit `years` or pass `[]` for snapshot only.
- Institution earnings cover federally aided undergraduate entrants working and not enrolled, regardless of completion. Returns medians at 6/8/10 years after entry, 6/10-year P25/P75, and non-male/male 6-year medians.
- `current_availability` and `trend[].availability` classify each supported metric; aggregate `suppressed` requires every current metric to carry an explicit privacy marker. Null and omitted values do not prove suppression.
- `current_context` and `trend[].context` give per-metric `data_file_year`, verified academic `entry_cohorts`, calendar `measurement_years`, and inflation `dollar_year`. Metadata comes from the official cohort maps; unknown parts are omitted. Values retain the provider's dollar basis, so cross-vintage comparisons require checking it. Each requested file adds six- and ten-year medians without extra requests.

---

### `scorecard_value_analysis` <sub>tool</sub>

- Accepts one school ID; optional `family_income` selects the applicable net price bracket ($0–30k, $30k–48k, $48k–75k, $75k–110k, or $110k+).
- Returns ratios alongside their source figures. `effective_net_price` discloses the price used, and `net_price_basis` is `income_bracket`, `overall`, or `unavailable`. A missing bracket preserves requested `family_income` / `applicable_income_bracket` and explains the established overall-price fallback in `data_notes`. Zero estimates remain valid; ratios require positive annual earnings.

---

### `scorecard_lookup_cip` <sub>tool</sub>

- Search by nonblank keyword or partial name (default limit 20); requests up to 1,000 are accepted and served at a cap of 50. Totals count before slicing; exact-cap results are not truncated, and no matches return an empty collection with guidance.
- Dotted `11.07` and undotted `1107` queries are equivalent. Returns exact group titles and family identities from 186 current NCES CIP 2020 four-digit groups; verified six-digit descendant names act as keyword aliases, returning their canonical group. This curated set is a subset of the full taxonomy.

---

### `scorecard_list_fields` <sub>tool</sub>

- Search 78 curated offline field entries by nonblank query (default limit 30); requests up to 1,000 are accepted and served at a cap of 100. Totals count before slicing; no matches return an empty collection with guidance. Use before passing custom `fields` to `scorecard_get_school`.
- Returns field paths, descriptions, data types, categories, and API sorting support; `tip` flags results containing unsortable fields.

---

### `scorecard://school/{id}` <sub>resource</sub>

- Institutional profile as `application/json` — identity, cost, admissions, outcomes, aid, and completion data
- `id` is the school unit ID (integer as string) from `scorecard_search_schools`
- `list` returns a handful of example school URIs; use `scorecard_search_schools` to discover others

---

### `scorecard://programs/{id}` <sub>resource</sub>

- Program-level outcomes as `application/json` — CIP code, title, credential level, 1-year earnings, cumulative Stafford/Grad PLUS debt, and `ipeds_awards_year1` / `ipeds_awards_year2` with the same meanings as the program tools; missing metrics are null
- `id` is the school unit ID from `scorecard_search_schools`
- `list` returns a handful of example school URIs; use `scorecard_search_schools` to discover others

---

### `scorecard_compare_prompt` <sub>prompt</sub>

- Arguments: `school_names` (comma-separated list) and `focus` (`costs` | `outcomes` | `programs`), both required
- Costs/outcomes sequence school discovery, `scorecard_compare_schools`, profiles, and value analysis. Programs sequence school discovery, CIP lookup, and `scorecard_get_programs` per school; compare matching credentials using returned earnings, cumulative debt, and IPEDS awards in the two pooled debt-cohort years. Missing values and award-year dates remain unknown.

## Features

Built on [`@cyanheads/mcp-ts-core`](https://github.com/cyanheads/mcp-ts-core): stdio and Streamable HTTP transports, pluggable auth (`none` / `jwt` / `oauth`), swappable storage (`in-memory`, `filesystem`, `Supabase`, `Cloudflare KV/R2/D1`), structured logging with optional OpenTelemetry tracing.

College Scorecard-specific:

- Full College Scorecard API coverage: ~6,500 Title IV institutions, ~2,800 data fields spanning costs, outcomes, demographics, financial aid, and field-of-study earnings
- Program-level earnings: median earnings of graduates working and not enrolled 1 year after their highest credential, per school × CIP code × credential level
- Field pre-selection per tool — curated field sets appropriate to each tool's purpose; optional `fields` override for custom queries
- Embedded CIP taxonomy (186 groups) and field catalog (78 fields) served offline
- Geographic filtering via U.S. zip code + distance radius

Agent-friendly output:

- Availability distinguishes numbers (including zero), unknown-cause missing values, and explicit `PS` / `PrivacySuppressed` provider markers. Confirmed privacy suppression does not identify its particular cause.
- Derived metrics alongside source figures in `scorecard_value_analysis` — agents can verify arithmetic and branch on computed values, not raw numbers
- Ordinal ranks in `scorecard_compare_schools` place each school's metric values within the comparison set
- School sorting uses indexed API fields; check `scorecard_list_fields` before choosing a sort expression. Six-year earnings does not support API sorting. Program earnings ordering applies within each fetched school page.
- Searches echo normalized effective selectors and pagination defaults on both output surfaces, distinguishing no upstream matches, exhausted pages, and locally filtered program pages. Blank optional selectors are unset; CIP precedence omits an ignored program name from the echo.
- Provider failures retain safe status/detail with distinct validation, authentication, throttling, timeout, and availability reasons. Permanent validation/authentication failures are not retried; resource failures include recovery and a request ID. Availability uses `api_error`; cancellation remains `RequestCancelled`.

## Getting started

### Public Hosted Instance

A public instance is available at `https://college-scorecard.caseyjhand.com/mcp` — no installation required. No API key needed; the instance supplies its own. Point any MCP client at it via Streamable HTTP:

```json
{
  "mcpServers": {
    "college-scorecard-mcp-server": {
      "type": "streamable-http",
      "url": "https://college-scorecard.caseyjhand.com/mcp"
    }
  }
}
```

### Self-Hosted / Local

Add the following to your MCP client configuration file. See [api.data.gov/signup](https://api.data.gov/signup/) for a free API key.

```json
{
  "mcpServers": {
    "college-scorecard-mcp-server": {
      "type": "stdio",
      "command": "bunx",
      "args": ["@cyanheads/college-scorecard-mcp-server@latest"],
      "env": {
        "MCP_TRANSPORT_TYPE": "stdio",
        "MCP_LOG_LEVEL": "info",
        "SCORECARD_API_KEY": "your-api-key"
      }
    }
  }
}
```

Or with npx (no Bun required):

```json
{
  "mcpServers": {
    "college-scorecard-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@cyanheads/college-scorecard-mcp-server@latest"],
      "env": {
        "MCP_TRANSPORT_TYPE": "stdio",
        "MCP_LOG_LEVEL": "info",
        "SCORECARD_API_KEY": "your-api-key"
      }
    }
  }
}
```

Or with Docker:

```json
{
  "mcpServers": {
    "college-scorecard-mcp-server": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "MCP_TRANSPORT_TYPE=stdio",
        "-e", "SCORECARD_API_KEY=your-api-key",
        "ghcr.io/cyanheads/college-scorecard-mcp-server:latest"
      ]
    }
  }
}
```

For Streamable HTTP, set the transport and start the server:

```sh
MCP_TRANSPORT_TYPE=http MCP_HTTP_PORT=3010 SCORECARD_API_KEY=... bun run start:http
# Server listens at http://localhost:3010/mcp
```

### Prerequisites

- [Bun v1.4.0](https://bun.sh/) or higher (or Node.js v24+).
- A College Scorecard API key — free registration at [api.data.gov/signup](https://api.data.gov/signup/). Rate limit: 1,000 requests/hour per key.

### Installation

1. **Clone the repository:**

```sh
git clone https://github.com/cyanheads/college-scorecard-mcp-server.git
```

2. **Navigate into the directory:**

```sh
cd college-scorecard-mcp-server
```

3. **Install dependencies:**

```sh
bun install
```

4. **Configure environment:**

```sh
cp .env.example .env
# edit .env and set SCORECARD_API_KEY
```

## Configuration

All configuration is validated at startup via Zod schemas in `src/config/server-config.ts`. Key environment variables:

| Variable | Description | Default |
|:---|:---|:---|
| `SCORECARD_API_KEY` | **Required.** API key from [api.data.gov](https://api.data.gov/signup/). 1,000 req/hour rate limit. | — |
| `MCP_TRANSPORT_TYPE` | Transport: `stdio` or `http` | `stdio` |
| `MCP_HTTP_PORT` | HTTP server port | `3010` |
| `MCP_HTTP_ENDPOINT_PATH` | HTTP endpoint path where the MCP server is mounted | `/mcp` |
| `MCP_PUBLIC_URL` | Public origin override for TLS-terminating reverse-proxy deployments | none |
| `MCP_SESSION_MODE` | HTTP session mode: `stateless`, `stateful`, or `auto`. The server declares `stateless` in code; an explicit env value overrides it. | `stateless` |
| `MCP_AUTH_MODE` | Authentication: `none`, `jwt`, or `oauth` | `none` |
| `MCP_LOG_LEVEL` | Log level (`debug`, `info`, `warning`, `error`, etc.) | `info` |
| `MCP_GC_PRESSURE_INTERVAL_MS` | Opt-in forced-GC pressure loop (ms, Bun only). Try `60000` if heap growth is observed under sustained HTTP load. | `0` (disabled) |
| `LOGS_DIR` | Directory for log files (Node.js only) | `<project-root>/logs` |
| `STORAGE_PROVIDER_TYPE` | Storage backend: `in-memory`, `filesystem`, `supabase`, `cloudflare-kv/r2/d1` | `in-memory` |
| `OTEL_ENABLED` | Enable [OpenTelemetry instrumentation](https://github.com/cyanheads/mcp-ts-core/tree/main/docs/telemetry) | `false` |

See [`.env.example`](./.env.example) for the full list of optional overrides.

## Running the server

### Local development

- **Build and run:**

  ```sh
  # One-time build
  bun run rebuild

  # Run the built server
  bun run start:stdio
  # or
  bun run start:http
  ```

- **Run checks and tests:**

  ```sh
  bun run devcheck   # Lint, format, typecheck, security
  bun run test       # Vitest test suite
  bun run lint:mcp   # Validate MCP definitions against spec
  ```

### Docker

```sh
docker build -t college-scorecard-mcp-server .
docker run --rm -e SCORECARD_API_KEY=your-key -p 3010:3010 college-scorecard-mcp-server
```

The Dockerfile defaults to HTTP transport, stateless session mode, and logs to `/var/log/college-scorecard-mcp-server`. OpenTelemetry peer dependencies are installed by default — build with `--build-arg OTEL_ENABLED=false` to omit them.

## Project structure

| Directory | Purpose |
|:---|:---|
| `src/index.ts` | `createApp()` entry point — registers tools/resources/prompts and inits services. |
| `src/config` | Server-specific environment variable parsing and validation with Zod. |
| `src/mcp-server/tools` | Tool definitions (`*.tool.ts`). Nine tools across search, profile, programs, earnings, and analysis. |
| `src/mcp-server/resources` | Resource definitions. School profile and program outcomes resources. |
| `src/mcp-server/prompts` | Prompt definitions. Multi-school comparison prompt. |
| `src/services` | `ScorecardService` — fetch wrapper with retry, field selection, and pagination against the College Scorecard API. |
| `tests/` | Unit and integration tests mirroring `src/`. |

## Development guide

See [`CLAUDE.md`](./CLAUDE.md) for development guidelines and architectural rules. The short version:

- Handlers throw, framework catches — no `try/catch` in tool logic
- Use `ctx.log` for request-scoped logging, `ctx.state` for tenant-scoped storage
- Register new tools, resources, and prompts in the `createApp()` arrays in `src/index.ts`
- Wrap external API calls: validate raw → normalize to domain type → return output schema; never fabricate missing fields

## Contributing

Issues are welcome. Run checks and tests before submitting:

```sh
bun run devcheck
bun run test
```

## License

Apache-2.0 — see [LICENSE](LICENSE) for details.
