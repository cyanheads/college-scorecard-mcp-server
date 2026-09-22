<div align="center">
  <h1>@cyanheads/college-scorecard-mcp-server</h1>
  <p><b>Search, compare, and analyze U.S. college data — costs, earnings, programs, and outcomes — via MCP. STDIO or Streamable HTTP.</b>
  <div>9 Tools • 2 Resources • 1 Prompt</div>
  </p>
</div>

<div align="center">

[![Version](https://img.shields.io/badge/Version-0.1.8-blue.svg?style=flat-square)](./CHANGELOG.md) [![License](https://img.shields.io/badge/License-Apache%202.0-orange.svg?style=flat-square)](./LICENSE) [![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/users/cyanheads/packages/container/package/college-scorecard-mcp-server) [![MCP SDK](https://img.shields.io/badge/MCP%20SDK-^2.0.0-green.svg?style=flat-square)](https://modelcontextprotocol.io/) [![npm](https://img.shields.io/npm/v/@cyanheads/college-scorecard-mcp-server?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/@cyanheads/college-scorecard-mcp-server) [![TypeScript](https://img.shields.io/badge/TypeScript-^7.0.2-3178C6.svg?style=flat-square)](https://www.typescriptlang.org/) [![Bun](https://img.shields.io/badge/Bun-v1.4.0-blueviolet.svg?style=flat-square)](https://bun.sh/)

</div>

<div align="center">

[![Install in Claude Desktop](https://img.shields.io/badge/Install_in-Claude_Desktop-D97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://github.com/cyanheads/college-scorecard-mcp-server/releases/latest/download/college-scorecard-mcp-server.mcpb) [![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=college-scorecard-mcp-server&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBjeWFuaGVhZHMvY29sbGVnZS1zY29yZWNhcmQtbWNwLXNlcnZlciJdLCJlbnYiOnsiU0NPUkVDQVJEX0FQSV9LRVkiOiJ5b3VyLWFwaS1rZXkifX0=) [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect?url=vscode:mcp/install?%7B%22name%22%3A%22college-scorecard-mcp-server%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40cyanheads%2Fcollege-scorecard-mcp-server%22%5D%2C%22env%22%3A%7B%22SCORECARD_API_KEY%22%3A%22your-api-key%22%7D%7D)

[![Framework](https://img.shields.io/badge/Built%20on-@cyanheads/mcp--ts--core-67E8F9?style=flat-square)](https://www.npmjs.com/package/@cyanheads/mcp-ts-core)

</div>

---

## Overview

U.S. college data from the Department of Education College Scorecard API — costs, earnings, programs, and outcomes across roughly 6,500 Title IV institutions. Search and compare schools, look up program-level earnings by field of study, and compute ROI metrics like debt-to-earnings ratio from any MCP client. Runs as a stdio process or a local Streamable HTTP server.

### Tools

| Tool | Description |
|:---|:---|
| `scorecard_search_schools` | Search and filter institutions by name, location, type, size, and acceptance rate range. Returns core identity and cost metrics. |
| `scorecard_get_school` | Full institutional profile for one or more school IDs — costs, admissions, outcomes, aid, demographics, and completion rates. |
| `scorecard_compare_schools` | Normalized side-by-side comparison of 2–5 schools on a named topic. Returns percentile-ranked rows and relative deltas within the result set. |
| `scorecard_get_programs` | All field-of-study programs at one school: median 1-year post-graduation earnings, debt at graduation, and enrollment figures. |
| `scorecard_search_programs` | Find programs by CIP code or keyword across all institutions, ranked by median earnings. Accepts school-side filters (state, ownership, max cost). |
| `scorecard_get_earnings` | Institution-level post-graduation earnings for one school — median at 6, 8, and 10 years after entry (P25/P75 at 6 and 10 years), with optional gender breakdown. |
| `scorecard_value_analysis` | Workflow tool: parallel-fetches cost, debt, repayment, and earnings data, then computes ROI metrics — debt-to-earnings ratio and net price to earnings ratio. |
| `scorecard_lookup_cip` | Search a curated ~160-code Classification of Instructional Programs (CIP) taxonomy by keyword or partial name. Served from embedded static data — no API call or rate-limit impact. |
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

- Free-text name search plus typed filters: state, ownership (public/private nonprofit/private for-profit), degree level, size range, acceptance rate range
- Geographic proximity filtering by U.S. zip code and distance (miles or km)
- CIP code filter to find schools offering a specific program family
- Pagination (`per_page` up to 100, zero-indexed `page`)
- Returns core identity and cost metrics for quick scanning

---

### `scorecard_get_school` <sub>tool</sub>

- Accepts a single ID or an array of IDs (batch fetch up to 100 per call)
- Covers costs, admissions, outcomes, financial aid, demographics, and completion rates
- Optional `fields` override for callers who need a narrower or broader field set
- For side-by-side comparison on a specific dimension, use `scorecard_compare_schools`

---

### `scorecard_compare_schools` <sub>tool</sub>

- 2–5 school unit IDs per call; four topics — `costs`, `admissions`, `outcomes`, `aid` — each pulls a curated topic-specific field set
- Computes within-set percentile ranks and relative deltas — structured output an agent cannot reconstruct from raw profiles
- Single API call for all schools; normalization applied post-fetch
- Distinct from `scorecard_get_school` with multiple IDs: output shape is rows, not profiles

---

### `scorecard_get_programs` <sub>tool</sub>

- Returns median 1-year post-graduation earnings, median debt at graduation, and enrollment figures per program
- Filter by CIP code to return only matching programs
- Filter by `credential_level` (certificate through doctoral/professional) and minimum earnings threshold
- Primary source for program-level earnings — institution-level earnings at 6/8/10 years are available via `scorecard_get_earnings`
- FERPA suppression surfaced as a structured `suppressed: true` flag with `suppression_note`, not bare null

---

### `scorecard_search_programs` <sub>tool</sub>

- Program-centric: "which schools in Washington have CS programs with median earnings over $80k?"
- School-side filters: state, ownership, max net price; program-side filters: min earnings, max debt
- Pagination (`per_page` up to 100, zero-indexed `page`) is at the school level — a school with multiple matching programs can return more rows than `per_page`
- Returns school ID (unit ID) and name alongside program metrics for chaining to `scorecard_get_school` or `scorecard_get_programs`
- Sorting applied post-fetch since earnings fields aren't API-indexed

---

### `scorecard_get_earnings` <sub>tool</sub>

- Median earnings at 6, 8, and 10 years after entry, with P25/P75 percentiles at 6 and 10 years
- Optional 6-year gender breakdown (`earnings_6yr_female_median` / `earnings_6yr_male_median`) when reported
- Optional `years` array of cohort entry years returns a per-year trend row (6yr and 10yr median) alongside the current snapshot
- Institution-wide across all graduates — for program-specific earnings use `scorecard_get_programs`, for ROI analysis use `scorecard_value_analysis`
- Top-level `suppressed` / `suppression_note` flags when earnings are unavailable at every time point

---

### `scorecard_value_analysis` <sub>tool</sub>

- Parallel-fetches cost/debt/repayment and earnings data in two concurrent requests
- Computes ROI metrics the API doesn't pre-calculate: debt-to-earnings ratio (median debt / 6-year earnings) and net price to annualized 6-year earnings ratio
- `family_income` parameter selects the applicable net price bracket ($0–30k, $30k–48k, $48k–75k, $75k–110k, $110k+)
- Returns all source figures alongside derived metrics — callers can audit the arithmetic
- `data_notes` array flags any suppressed or missing fields with plain-language explanations

---

### `scorecard_lookup_cip` <sub>tool</sub>

- Curated set of ~160 common 4-digit CIP codes embedded as static data — not the full NCES taxonomy
- No API call required — zero rate-limit impact, works offline
- Required before using CIP-based filters when the caller knows a program by name but not code
- Up to 50 results per call (`limit`, default 20)
- Returns matching codes with standard titles and CIP family

---

### `scorecard_list_fields` <sub>tool</sub>

- ~79 field entries curated from the Scorecard data dictionary, embedded as static data
- No API call required — zero rate-limit impact
- Returns field path, description, data type, category, and whether it supports API-side sorting
- Up to 100 results per call (`limit`, default 30)
- Use before passing custom `fields` parameters to `scorecard_search_schools` or `scorecard_get_school`; a `tip` field flags when results include unsortable fields

---

### `scorecard://school/{id}` <sub>resource</sub>

- Institutional profile as `application/json` — identity, cost, admissions, outcomes, aid, and completion data
- `id` is the school unit ID (integer as string) from `scorecard_search_schools`
- `list` returns a handful of example school URIs; use `scorecard_search_schools` to discover others

---

### `scorecard://programs/{id}` <sub>resource</sub>

- Program-level outcomes as `application/json` — CIP code, title, credential level, 1-year earnings, debt, and enrollment per program
- `id` is the school unit ID from `scorecard_search_schools`
- `list` returns a handful of example school URIs; use `scorecard_search_schools` to discover others

---

### `scorecard_compare_prompt` <sub>prompt</sub>

- Arguments: `school_names` (comma-separated list) and `focus` (`costs` | `outcomes` | `programs`), both required
- Returns one user message sequencing `scorecard_search_schools` → `scorecard_compare_schools` → `scorecard_get_school`, plus `scorecard_get_programs`/`scorecard_lookup_cip` when focus is `programs` or `scorecard_value_analysis` otherwise

## Features

Built on [`@cyanheads/mcp-ts-core`](https://github.com/cyanheads/mcp-ts-core): stdio and Streamable HTTP transports, pluggable auth (`none` / `jwt` / `oauth`), swappable storage (`in-memory`, `filesystem`, `Supabase`, `Cloudflare KV/R2/D1`), structured logging with optional OpenTelemetry tracing.

College Scorecard-specific:

- Full College Scorecard API coverage: ~6,500 Title IV institutions, ~2,800 data fields spanning costs, outcomes, demographics, financial aid, and field-of-study earnings
- Program-level post-graduation earnings: median earnings 1 year after graduation per school × CIP code combination
- Field pre-selection per tool — curated field sets appropriate to each tool's purpose; optional `fields` override for custom queries
- Embedded CIP code taxonomy (~160 codes) and field catalog (~79 fields) served as static data — zero API calls, zero rate-limit impact
- Geographic filtering via U.S. zip code + distance radius

Agent-friendly output:

- FERPA suppression surfaced as structured `suppressed: true` flag with `suppression_note` — prevents hallucination of missing earnings data at selective schools with small cohorts
- Derived metrics alongside source figures in `scorecard_value_analysis` — agents can verify arithmetic and branch on computed values, not raw numbers
- Percentile ranks and relative deltas in `scorecard_compare_schools` — structured output an agent cannot reconstruct from raw profiles without knowing the full comparison set
- Post-fetch sorting documented and handled transparently — callers never hit API errors on non-indexed sort fields

## Getting started

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
