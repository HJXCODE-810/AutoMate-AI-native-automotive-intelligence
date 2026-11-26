# Repository Guidelines

## Project Structure & Module Organization

AutoMate OS has a runnable local catalog foundation. Seeded telemetry, persistence, and AI are future milestones.

- `docs/`: foundation design, ADRs, manufacturer research, and reviewed test cases.
- `packages/catalog/data/catalog-seed.json`: fictional profiles, signals, rules, and scenarios.
- `packages/catalog/data/manual-observations.json`: non-executable manufacturer observations.

Source lives in `apps/web/src`, `apps/api/src`, and `packages/{domain,catalog,simulation}/src`. Tests are colocated; illustrations are inline SVG. Keep simulation independent of UI, database, HTTP, and OpenAI SDK code. Cluster projection and persistence remain planned.

## Build, Test, and Development Commands

Use Node.js 22.12+ and npm workspaces. Run from the root:

- `npm ci`: install locked dependencies.
- `npm run dev`: start web (5173) and API (3001).
- `npm run typecheck`: check strict TypeScript.
- `npm test`: execute reviewed Vitest cases.
- `npm run build`: typecheck and build both applications.
- `git diff --check`: check changed whitespace.

Use `npm.cmd` on PowerShell if `npm.ps1` is blocked. API edits require restarting the development launcher; web edits reload automatically.

## Coding Style & Naming Conventions

Use two-space indentation for new JSON and TypeScript. Prefer strict TypeScript, explicit boundary types, and pure simulation functions. No formatter or linter is configured yet.

Use stable dotted signal IDs (`engine.rpm`), descriptive profile IDs (`compact-petrol-v1`), and sequential ADR filenames. Preserve catalog versions and source references when changing data.

## Testing Guidelines

Write test cases before execution. Have a Review Agent review coverage, assertions, and expected outcomes; resolve findings before running tests. New or materially changed cases require the same gate. Record approval and execution results separately.

Vitest is installed; Playwright is not. Use `*.test.ts` for unit/contract tests and `*.spec.ts` for future browser tests. Follow `docs/testing/FOUNDATION_TEST_PLAN.md`. Prioritize replay, capability gating, references, warning transitions, and authorization as implemented. No coverage percentage is established. Record results in `evidence/README.md`.

## Commit & Pull Request Guidelines

Use imperative commit subjects, following `Add project description to README.md` in existing history. Keep commits focused. Use `codex/` for agent-created branches. PRs should explain purpose, changed behavior or design, verification, limitations, and related issues when applicable. Include flowcharts for architecture changes and screenshots for implemented UI changes.

## Security & Data Integrity

Keep credentials out of Git and browser bundles; use hosted runtime secrets and untracked local environment files. Use official OpenAI APIs for AI features. Label synthetic data and fictional thresholds explicitly. Preserve unknown manufacturer limits and applicability gaps. Keep the product simulation-only, without vehicle control or real diagnostic claims.
