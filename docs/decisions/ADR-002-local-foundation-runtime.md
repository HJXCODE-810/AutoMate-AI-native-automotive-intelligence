# ADR-002: Local workspace and a portable API boundary

- Status: Accepted for the Day 2 local foundation
- Date: 2026-11-25
- Supersedes: ADR-001 only for the initial HTTP adapter; durable storage remains undecided for deployment

## Context

PR #1 merged the initial design into main at `622f0ce0fa394828a4be1315562c60b8ef86162b`. The next task is a runnable local vehicle catalog with no OpenAI credits required. The user intends to consider Sites hosting later. Sites server code runs in a Worker runtime, while the draft design assumed a Node server. This implementation should isolate that runtime choice from vehicle and catalog logic.

## Decision

Use npm workspaces, strict TypeScript, React/Vite for the web interface, Zod for data and API contracts, and Vitest for the initial behavioral suite. Check in a lockfile. Keep the domain and catalog as independent packages.

Implement the read-only API as a Web-standard `Request -> Promise<Response>` handler with a default `{ fetch }` export. A small Node HTTP adapter starts it on loopback for local development. The API build bundles browser-compatible dependencies into an ESM file; Node built-ins are confined to the dev adapter. Fastify is deferred rather than coupled to domain modules.

The Vite dev and preview servers proxy `/api` to the local API. Both startup processes run from one Node launcher so Windows does not need to change PowerShell execution policy. Use `npm.cmd` if `npm.ps1` is blocked.

Load the checked-in synthetic catalog after schema and reference validation. Manufacturer observations remain a separate non-executable research document. The initial read-only API exposed metadata and capabilities only. The simulation API and storage choice were added later in ADR-003.

## Consequences

- Local development needs Node and npm, but no database or API key.
- Data constraints and capabilities can be checked before sensor generation is implemented.
- The fetch boundary preserves a path to Worker hosting, without claiming a complete Sites deployment package.
- Local builds produce separate web and API outputs. A future hosting task must integrate static assets, runtime bindings, access controls, and storage before publication.
- PostgreSQL in ADR-001 is a logical persistence proposal, not a provisioned dependency. Evaluate Worker-compatible storage and document that decision when adding durability.
- Web-standard HTTP tests exercise the same handler as the local API. Browser acceptance tests remain separately recorded.

## Delivery gates

The user requires test cases to be reviewed by a Review Agent before execution. See [the test plan](../testing/FOUNDATION_TEST_PLAN.md). Review approval, typecheck, automated results, and observed browser behavior are distinct evidence.
