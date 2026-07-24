# Upstream relationship

- **Upstream:** https://github.com/chrisdoc/hevy-mcp
- **Divergence (as of 2026-07-24):** +4 ahead / -484 behind upstream default branch
- **Fork type:** Contribution/maintenance fork
- **Sync cadence:** Manual; heavily behind upstream, sync opportunistically.

## StartupBros-specific delta

Local-dev/debug base for the live Hevy MCP server wired into will-os. Carries axios error-response extraction and a fix dropping broken routine payload fields.

## Why this file exists

An org-wide audit on 2026-07-24 found that comparing only the *default* branch made
several forks look like zero-delta mirrors when they actually carried unmerged
StartupBros fixes on side branches. Any future fork-pruning pass must enumerate and
author-check **all** branches, not just default-branch ahead/behind.
