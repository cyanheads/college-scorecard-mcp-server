<div align="center">
  <h1>@cyanheads/college-scorecard-mcp-server</h1>
  <p><b>Search, compare, and analyze U.S. college data — costs, earnings, programs, and outcomes — via MCP. STDIO or Streamable HTTP.</b>
  <div>9 Tools • 2 Resources • 1 Prompt</div>
  </p>
</div>

<div align="center">

[![Version](https://img.shields.io/badge/Version-0.1.9-blue.svg?style=flat-square)](./CHANGELOG.md) [![License](https://img.shields.io/badge/License-Apache%202.0-orange.svg?style=flat-square)](./LICENSE) [![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/users/cyanheads/packages/container/package/college-scorecard-mcp-server) [![MCP SDK](https://img.shields.io/badge/MCP%20SDK-^2.1.0-green.svg?style=flat-square)](https://modelcontextprotocol.io/) [![npm](https://img.shields.io/npm/v/@cyanheads/college-scorecard-mcp-server?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/@cyanheads/college-scorecard-mcp-server) [![TypeScript](https://img.shields.io/badge/TypeScript-^7.0.2-3178C6.svg?style=flat-square)](https://www.typescriptlang.org/) [![Bun](https://img.shields.io/badge/Bun-v1.4.2-blueviolet.svg?style=flat-square)](https://bun.sh/)

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
| `scorecard_search_schools` | Search institutions by name, location, type, size, acceptance rate, and single-sex flags; sort by supported API fields. Returns core identity and cost metrics. |
| `scorecard_get_school` | Full institutional profiles — costs, admissions, outcomes, aid, demographics, single-sex flags, and completion rates. |
| `scorecard_compare_schools` | Normalized side-by-side comparison of 2–5 schools on a named topic. Returns percentile-ranked rows and relative deltas within the result set. |
| `scorecard_get_programs` | Field-of-study programs at one school: median 1-year earnings, cumulative Stafford/Grad PLUS debt, and IPEDS awards in the two pooled debt-cohort years. |
| `scorecard_search_programs` | Find programs by CIP code or keyword, with school, earnings, and debt filters; rank by earnings within each fetched school page. |
| `scorecard_get_earnings` | Institution-level post-graduation earnings for one school — median at 6, 8, and 10 years after entry (P25/P75 at 6 and 10 years), with optional gender breakdown. |
| `scorecard_value_analysis` | Workflow tool: parallel-fetches cost, debt, repayment, and earnings data, then computes ROI metrics — debt-to-earnings ratio and net price to earnings ratio. |
| `scorecard_lookup_cip` | Search 202 curated Classification of Instructional Programs (CIP) codes by keyword or partial name. Served from embedded static data — no API call or rate-limit impact. |
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

- Search by name, state, ownership, degree level, size, acceptance rate, CIP code, or zip code and distance; `per_page` is capped at 100 with zero-indexed `page`.
- Returns core identity and cost metrics for quick scanning.
- `sort` forwards a supported API expression such as `latest.cost.avg_net_price.overall:asc` (`:desc` reverses it). `men_only` and `women_only` accept true or false; omission includes unknown flags, while false selects only explicit zero values.

---

### `scorecard_get_school` <sub>tool</sub>

- Accepts a single school ID or an array of up to 100 IDs per call.
- Returns institutional profiles covering costs, admissions, outcomes, financial aid, demographics, and completion rates; `fields` overrides the default selection. `men_only` and `women_only` preserve true/false when known and are absent when unknown.

---

### `scorecard_compare_schools` <sub>tool</sub>

- Accepts 2–5 school unit IDs and one topic: `costs`, `admissions`, `outcomes`, or `aid`.
- Returns comparison rows with within-set percentile ranks and relative deltas from a single API call.

---

### `scorecard_get_programs` <sub>tool</sub>

- Accepts one school ID, with optional CIP code, `credential_level`, and minimum earnings filters.
- Returns median earnings and the matching count of graduates working and not enrolled 1 year after their highest credential, with `suppressed` and `suppression_note` for unavailable earnings.
- `median_debt` is completers' cumulative Stafford/Grad PLUS borrowing across attended institutions at the same academic level. `ipeds_awards_year1` and `ipeds_awards_year2` count awards in each year of the pooled debt cohort, not enrollment or unique students.

---

### `scorecard_search_programs` <sub>tool</sub>

- Search by CIP code or program name, with state, ownership, net price, earnings, and debt filters; zero-indexed `page` and `per_page` (up to 100) paginate schools, so returned program rows may exceed `per_page`.
- Returns school IDs and names alongside program metrics, sorted by earnings within the fetched page.
- `min_earnings` filters locally; totals and pagination remain upstream school counts before local filtering. Earnings/debt thresholds are inclusive and exclude unknown values. Debt and award fields have the same meanings as in `scorecard_get_programs`.

---

### `scorecard_get_earnings` <sub>tool</sub>

- Accepts one school ID and optional `years` for cohort trends and a gender-breakdown option.
- Returns median earnings at 6, 8, and 10 years after entry, P25/P75 at 6 and 10 years, and optional 6-year female/male medians; `suppressed` and `suppression_note` flag earnings unavailable at every time point.
- Each requested trend year adds its 6-year and 10-year median alongside the current snapshot.

---

### `scorecard_value_analysis` <sub>tool</sub>

- Accepts one school ID; optional `family_income` selects the applicable net price bracket ($0–30k, $30k–48k, $48k–75k, $75k–110k, or $110k+).
- Returns debt-to-earnings and net-price-to-earnings ratios alongside the source figures; `data_notes` explains suppressed or missing fields.

---

### `scorecard_lookup_cip` <sub>tool</sub>

- Search by keyword or partial name with `limit` up to 50 (default 20); use before CIP filters when the code is unknown.
- Returns codes, standard titles, and CIP families from a curated offline set of 202 common 4-digit codes, rather than the full NCES taxonomy.

---

### `scorecard_list_fields` <sub>tool</sub>

- Search 80 curated offline field entries with `limit` up to 100 (default 30); use before passing custom `fields` to `scorecard_get_school`.
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
- Returns one user message sequencing `scorecard_search_schools` → `scorecard_compare_schools` → `scorecard_get_school`, plus `scorecard_get_programs`/`scorecard_lookup_cip` when focus is `programs` or `scorecard_value_analysis` otherwise

## Features

Built on [`@cyanheads/mcp-ts-core`](https://github.com/cyanheads/mcp-ts-core): stdio and Streamable HTTP transports, pluggable auth (`none` / `jwt` / `oauth`), swappable storage (`in-memory`, `filesystem`, `Supabase`, `Cloudflare KV/R2/D1`), structured logging with optional OpenTelemetry tracing.

College Scorecard-specific:

- Full College Scorecard API coverage: ~6,500 Title IV institutions, ~2,800 data fields spanning costs, outcomes, demographics, financial aid, and field-of-study earnings
- Program-level earnings: median earnings of graduates working and not enrolled 1 year after their highest credential, per school × CIP code × credential level
- Field pre-selection per tool — curated field sets appropriate to each tool's purpose; optional `fields` override for custom queries
- Embedded CIP code taxonomy (202 codes) and field catalog (80 fields) served as static data — zero API calls, zero rate-limit impact
- Geographic filtering via U.S. zip code + distance radius

Agent-friendly output:

- FERPA suppression surfaced as structured `suppressed: true` flag with `suppression_note` — prevents hallucination of missing earnings data at selective schools with small cohorts
- Derived metrics alongside source figures in `scorecard_value_analysis` — agents can verify arithmetic and branch on computed values, not raw numbers
- Percentile ranks and relative deltas in `scorecard_compare_schools` — structured output an agent cannot reconstruct from raw profiles without knowing the full comparison set
- School sorting uses indexed API fields; check `scorecard_list_fields` before choosing a sort expression. Six-year earnings does not support API sorting. Program earnings ordering applies within each fetched school page.

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
