<div align="center">
  <h1>@cyanheads/college-scorecard-mcp-server</h1>
  <p><b>Search, compare, and analyze U.S. college data — costs, earnings, programs, and outcomes — via MCP. STDIO or Streamable HTTP.</b>
  <div>9 Tools • 2 Resources • 1 Prompt</div>
  </p>
</div>

<div align="center">

[![Version](https://img.shields.io/badge/Version-0.4.0-blue.svg?style=flat-square)](./CHANGELOG.md) [![License](https://img.shields.io/badge/License-Apache%202.0-orange.svg?style=flat-square)](./LICENSE) [![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/users/cyanheads/packages/container/package/college-scorecard-mcp-server) [![MCP SDK](https://img.shields.io/badge/MCP%20SDK-^2.3.1-green.svg?style=flat-square)](https://modelcontextprotocol.io/) [![npm](https://img.shields.io/npm/v/@cyanheads/college-scorecard-mcp-server?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/@cyanheads/college-scorecard-mcp-server) [![TypeScript](https://img.shields.io/badge/TypeScript-^7.0.2-3178C6.svg?style=flat-square)](https://www.typescriptlang.org/) [![Bun](https://img.shields.io/badge/Bun-v1.4.3-blueviolet.svg?style=flat-square)](https://bun.sh/)

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

US college data from the Department of Education College Scorecard: costs, earnings, programs, and outcomes across roughly 6,500 institutions. Search and compare schools, look up earnings by field of study, and compute ROI metrics like debt-to-earnings ratio.

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
| `scorecard_lookup_cip` | Search 186 curated NCES CIP 2020 four-digit groups by code, keyword, or related program name. Served offline. |
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

- Search by name, state, ownership, degree level, size, acceptance rate, CIP code, or ZIP and distance (miles or `km`). `per_page` is capped at 100; `page` is zero-indexed. State lists accept `WA,CA`.
- Returns core identity and cost metrics for quick scanning.
- `sort` takes an API expression such as `latest.cost.avg_net_price.overall:asc` (`:desc` reverses it). `men_only` and `women_only` accept true or false.

---

### `scorecard_get_school` <sub>tool</sub>

- Accepts a school ID or an array of up to 1,000. The first 100 distinct IDs are fetched; `missing_ids` lists fetched IDs with no record and `unprocessed_ids` lists the excess.
- Default profiles cover costs, admissions, outcomes, financial aid, demographics, and completion rates. Custom `fields` returns `selected_fields` with the requested values, and `absent_fields` lists requested paths missing from the response.
- HBCU and single-sex flags are true/false when known and unknown when absent.

---

### `scorecard_compare_schools` <sub>tool</sub>

- Accepts 2–5 school unit IDs and one topic: `costs`, `admissions`, `outcomes`, or `aid`.
- Returns metric values and ranks from one API call: equal values share a rank (1, 1, 3) and unavailable values are unranked.
- Each cell's `availability` distinguishes available, unavailable, and privacy-suppressed values.

---

### `scorecard_get_programs` <sub>tool</sub>

- Accepts one school ID, with optional CIP code (dotted or undotted), `credential_level`, and minimum earnings filters. A school with no matching programs returns an empty collection; a nonexistent school is a lookup error.
- Returns median earnings and graduate counts 1 year after the highest credential. `earnings_availability` is `available`, `unavailable`, or `privacy_suppressed`, with `suppressed_count` and `unavailable_count`.
- `median_debt` is completers' cumulative Stafford/Grad PLUS borrowing. `ipeds_awards_year1` and `ipeds_awards_year2` count awards in each year of the pooled debt cohort, not students.

---

### `scorecard_search_programs` <sub>tool</sub>

- Search by CIP code or program name, with optional integer `credential_level` (1–8 and 99), state, ownership, net price, earnings, and debt filters. Zero-indexed `page` and `per_page` (up to 100) paginate schools, so returned program rows may exceed `per_page`.
- Returns school IDs and names with program metrics, `credential_level`, and `credential_title`. Available earnings sort first; availability, debt, and award fields match `scorecard_get_programs`.
- `min_earnings` filters locally, so totals and pagination are upstream school counts before filtering. Earnings and debt thresholds are inclusive and exclude unknown values.

---

### `scorecard_get_earnings` <sub>tool</sub>

- Accepts one school ID and optional data-file start `years` from 1996–2025 (file vintages, not entry years). Omit `years` or pass `[]` for the snapshot only.
- Covers federally aided undergraduate entrants working and not enrolled, regardless of completion: medians at 6/8/10 years after entry, 6/10-year P25/P75, and non-male/male 6-year medians.
- `current_availability` and `trend[].availability` classify each metric. `current_context` and `trend[].context` give `data_file_year`, `entry_cohorts`, `measurement_years`, and `dollar_year`; values keep the provider's dollar basis, so check it before comparing across vintages.

---

### `scorecard_value_analysis` <sub>tool</sub>

- Accepts one school ID; optional `family_income` selects the applicable net price bracket ($0–30k, $30k–48k, $48k–75k, $75k–110k, or $110k+).
- Returns ratios alongside their source figures. `effective_net_price` is the price used, and `net_price_basis` is `income_bracket`, `overall`, or `unavailable`.
- If the bracket is missing, the overall price is used and `data_notes` says so. Ratios require positive annual earnings.

---

### `scorecard_lookup_cip` <sub>tool</sub>

- Search by nonblank keyword or partial name (default limit 20, capped at 50). Dotted `11.07` and undotted `1107` are equivalent.
- Returns exact group titles and family identities from 186 current NCES CIP 2020 four-digit groups, a subset of the full taxonomy. Related six-digit program names also match and return their group; no matches return an empty collection with guidance.

---

### `scorecard_list_fields` <sub>tool</sub>

- Search 78 curated offline field entries by nonblank query (default limit 30, capped at 100). Use before passing custom `fields` to `scorecard_get_school`.
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
- `costs` and `outcomes` run school discovery, `scorecard_compare_schools`, profiles, and value analysis. `programs` runs school discovery, CIP lookup, and `scorecard_get_programs` per school, then compares earnings, debt, and IPEDS awards for matching credentials.

## Features

Built on [`@cyanheads/mcp-ts-core`](https://github.com/cyanheads/mcp-ts-core): stdio and Streamable HTTP transports, pluggable auth (`none` / `jwt` / `oauth`), swappable storage (`in-memory`, `filesystem`, `Supabase`, `Cloudflare KV/R2/D1`), structured logging with optional OpenTelemetry tracing.

College Scorecard-specific:

- Full College Scorecard API coverage: ~6,500 Title IV institutions, ~2,800 data fields spanning costs, outcomes, demographics, financial aid, and field-of-study earnings
- Program-level earnings: median earnings of graduates working and not enrolled 1 year after their highest credential, per school × CIP code × credential level
- Field pre-selection per tool — curated field sets appropriate to each tool's purpose; optional `fields` override for custom queries
- Embedded CIP taxonomy (186 groups) and field catalog (78 fields) served offline
- Geographic filtering via U.S. zip code + distance radius

Agent-friendly output:

- Availability distinguishes numbers (including zero), missing values, and explicit `PS` / `PrivacySuppressed` provider markers
- Derived metrics sit alongside source figures in `scorecard_value_analysis`, and `scorecard_compare_schools` adds ordinal ranks
- School sorting uses indexed API fields; check `scorecard_list_fields` before choosing a sort expression. Six-year earnings does not support API sorting.
- Provider failures report distinct validation, authentication, throttling, timeout, and availability reasons; availability uses `api_error` and cancellation remains `RequestCancelled`

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
| `SCORECARD_API_KEY` | **Required.** API key from [api.data.gov](https://api.data.gov/signup/) (1,000 req/hour). | — |
| `MCP_TRANSPORT_TYPE` | Transport: `stdio` or `http` | `stdio` |
| `MCP_HTTP_PORT` | HTTP server port | `3010` |
| `MCP_HTTP_ENDPOINT_PATH` | HTTP endpoint path where the MCP server is mounted | `/mcp` |
| `MCP_PUBLIC_URL` | Public origin override for TLS-terminating reverse-proxy deployments | none |
| `MCP_SESSION_MODE` | HTTP session mode: `stateless`, `stateful`, or `auto` | `stateless` |
| `MCP_AUTH_MODE` | Authentication: `none`, `jwt`, or `oauth` | `none` |
| `MCP_LOG_LEVEL` | Log level (`debug`, `info`, `warning`, `error`, etc.) | `info` |
| `MCP_GC_PRESSURE_INTERVAL_MS` | Opt-in forced-GC loop interval in ms (Bun only); try `60000` if heap grows under HTTP load | `0` (disabled) |
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
