# Repository Guidelines

## Project Structure & Module Organization

AutoMate OS is at the design stage; no runnable application, test suite, or asset directory exists yet.

- `docs/FOUNDATION_DESIGN.md`: architecture, API boundaries, and implementation sequence.
- `docs/decisions/`: architecture decision records, such as `ADR-001-foundation.md`.
- `docs/research/`: manufacturer references, findings, and unresolved coverage gaps.
- `packages/catalog/data/catalog-seed.json`: fictional profiles, signals, warning rules, and scenarios.
- `packages/catalog/data/manual-observations.json`: sourced research observations; these are non-executable.

The planned TypeScript structure uses `apps/web`, `apps/api`, and packages for domain, catalog, simulation, cluster projection, and persistence. Keep simulation independent of UI, database, HTTP, and OpenAI SDK code.

## Build, Test, and Development Commands

There is no `package.json`, lockfile, or configured build pipeline. Do not report `npm test` or `npm run build` as available or passing.

Current checks include:

```powershell
git diff --check
Get-Content -Raw packages/catalog/data/catalog-seed.json | ConvertFrom-Json | Out-Null
Get-Content -Raw packages/catalog/data/manual-observations.json | ConvertFrom-Json | Out-Null
```

These check diff whitespace and JSON syntax. When scaffolding the application, document actual development, typecheck, test, and build scripts in `README.md`.

## Coding Style & Naming Conventions

Use two-space indentation for new JSON and TypeScript. Prefer strict TypeScript, explicit boundary types, and pure simulation functions. No formatter or linter is configured yet.

Use stable dotted signal IDs (`engine.rpm`), descriptive profile IDs (`compact-petrol-v1`), and sequential ADR filenames. Preserve catalog versions and source references when changing data.

## Testing Guidelines

Vitest and Playwright are proposed tools, not installed dependencies. Use `*.test.ts` for unit tests and `*.spec.ts` for browser tests when introduced. Prioritize deterministic replay, unsupported-signal gating, valid references, warning transitions, and resource authorization. No coverage percentage is established. Report actual checks and limitations.

## Commit & Pull Request Guidelines

The existing history uses an imperative subject: `Add project description to README.md`. Follow that concise style and keep commits focused. Use `codex/` for agent-created branches. PRs should explain purpose, changed behavior or design, verification, limitations, and related issues when applicable. Include flowcharts for architecture changes and screenshots for implemented UI changes.

## Security & Data Integrity

Keep credentials out of Git and browser bundles; use hosted runtime secrets and untracked local environment files. Use official OpenAI APIs for AI features. Label synthetic data and fictional thresholds explicitly. Preserve unknown manufacturer limits and applicability gaps. Keep the product simulation-only, without vehicle control or real diagnostic claims.
