# Changelog

All notable changes to this project. Each entry links to its full per-version file in [changelog/](changelog/).

## [0.1.7](changelog/0.1.x/0.1.7.md) — 2026-06-19

Adopt @cyanheads/mcp-ts-core ^0.10.8 — devcheck fresh-scaffold guards, check-skill-versions worktree-deletion guard, seven re-synced skills, biome 2.5; plus @types/node ^26 and a dependency refresh. No tool surface changes.

## [0.1.6](changelog/0.1.x/0.1.6.md) — 2026-06-19

Repayment field corrected and renamed (repayment_rate_3yr → repayment_progress_3yr; was a borrower count rendering as ~1078%), and net price by income bracket now populates via the correct ownership-keyed API paths (was always null). Dependency refresh.

## [0.1.5](changelog/0.1.x/0.1.5.md) — 2026-06-12

Adopt @cyanheads/mcp-ts-core ^0.10.6: out-of-band enrichment (ctx.enrich) replaces notice/pagination output fields, with new truncation and total-count signals on list and search tools. Plugin manifests, Dockerfile healthcheck, dependency refresh.

## [0.1.4](changelog/0.1.x/0.1.4.md) — 2026-05-26

Package metadata alignment: author, funding, FUNDING.yml, README install badges, Dockerfile build stage, manifest.json, server.json, scripts use bun run.

## [0.1.3](changelog/0.1.x/0.1.3.md) — 2026-05-25

Dockerfile build stage switched to node:24-slim for tsx compatibility.

## [0.1.2](changelog/0.1.x/0.1.2.md) — 2026-05-25

Add mcpName field and publish-mcp script for MCP Registry publication.

## [0.1.1](changelog/0.1.x/0.1.1.md) — 2026-05-25

Field-test fixes — CIP code filtering, repayment rate scaling, credential level path, and format output cleanup.

## [0.1.0](changelog/0.1.x/0.1.0.md) — 2026-05-25

Initial release — 9 College Scorecard tools (institution search, program earnings, school comparison, value analysis), 2 resources, 1 prompt, embedded CIP taxonomy and field catalog.
