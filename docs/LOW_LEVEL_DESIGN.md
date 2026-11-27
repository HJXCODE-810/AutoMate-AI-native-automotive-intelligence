# AutoMate OS low-level design

Status: describes the implementation in this repository as of 2026-11-27. Solid paths below are implemented. Dashed paths are future work.

## 1. Architecture at a glance

```mermaid
flowchart LR
  Browser[React browser app\napps/web/src/main.tsx]
  Styles[UI styles\napps/web/src/styles.css]
  Vite[Vite dev server\napps/web/vite.config.ts]
  ApiHandler[Web-standard API\napps/api/src/index.ts]
  NodeAdapter[Local Node adapter\napps/api/src/dev.ts]
  Seed[(Fictional catalog seed\npackages/catalog/data/catalog-seed.json)]
  Domain[Domain schemas and types\npackages/domain/src/index.ts]
  Catalog[Catalog validation and registry\npackages/catalog/src/index.ts\npackages/catalog/src/registry.ts]
  Sim[Deterministic simulation\npackages/simulation/src/index.ts]
  Repository[Session repository interface\napps/api/src/session-repository.ts]
  Memory[(In-memory adapter\ndefault without DATABASE_URL)]
  PostgresRepo[PostgreSQL adapter\napps/api/src/postgres-session-repository.ts]
  Postgres[(PostgreSQL\nsessions, snapshots, signals, events, indicators, reports)]
  Migration[SQL migration\napps/api/db/migrations/001_initial.sql]
  Research[Manufacturer observations\nnon-executable]
  AI[OpenAI investigator\npostponed]

  Browser -->|/api requests| Vite
  Vite -->|proxy /api to local API| NodeAdapter
  NodeAdapter -->|forwards method, content headers, body| ApiHandler
  ApiHandler -->|catalog and capability reads| Catalog
  Seed --> Catalog
  Catalog --> Domain
  Sim --> Domain
  ApiHandler --> Sim
  ApiHandler --> Repository
  Repository --> Memory
  Repository --> PostgresRepo
  PostgresRepo --> Postgres
  Migration --> Postgres
  Browser --> Styles
  Research -. excluded from runtime .-> Catalog
  Sim -. deterministic evidence only .-> AI
```

**Runtime boundaries:** Domain schemas have no app dependencies. Catalog and simulation depend on domain types, but not on React, HTTP, a database, or an AI SDK. The API composes catalog, simulation, and an injected repository, then exposes Web-standard `Request`/`Response` handlers. The Node adapter is the only place that loads `pg`, reads `.env`, runs migrations, and creates a PostgreSQL connection pool. Reports use in-memory storage when `DATABASE_URL` is absent and PostgreSQL when it is present.

## 2. Main interaction: select, simulate, fault, explain, save

```mermaid
sequenceDiagram
  actor Driver as User
  participant UI as React app
  participant API as API handler
  participant Registry as Catalog registry
  participant Engine as Simulation package
  participant Store as SessionRepository

  UI->>API: GET /api/health
  UI->>API: GET /api/catalog/vehicles
  API-->>UI: health + fictional profile summaries
  Driver->>UI: Select vehicle
  UI->>API: GET /api/catalog/vehicles/{profileId}
  API->>Registry: getVehicle(profileId)
  Registry-->>API: capabilities + applicable scenarios
  API-->>UI: profile detail
  Driver->>UI: Choose scenario + seed, Start
  UI->>API: POST /api/sessions {vehicleProfileId, scenarioId, seed}
  API->>Engine: createSimulationSession(...)
  Engine-->>API: session at tick 0
  API->>Engine: getSimulationSnapshot(session)
  Engine-->>API: supported telemetry + current indicators
  API-->>UI: synthetic session snapshot
  Driver->>UI: Advance N ticks
  UI->>API: POST /api/sessions/{id}/advance {ticks:N}
  API->>Engine: advanceSimulation(session, N)
  Engine->>Engine: deterministic readings, scenario actions, event rules
  Engine-->>API: updated snapshot + rule-linked explanations
  API-->>UI: updated cluster and signal values
  Driver->>UI: Save report
  UI->>API: POST /api/sessions/{id}/report
  API->>Store: save session and snapshot under report id
  Store-->>API: saved, with selected durability
  API-->>UI: report id + durability notice
```

### Tick and warning behavior

1. The API creates a session only when the profile and scenario exist, the scenario includes the profile, and the seed is a safe nonnegative 32-bit integer.
2. The simulator creates values only for `profile.supportedSignalIds`. Number signals start from fictional demonstration baselines with deterministic seed/tick/signal jitter; enum and boolean signals use deterministic generated values.
3. When a session advances, the simulator applies scenario actions up to the new tick. `set_signal` sets a value, `ramp_signal` interpolates a numeric value, and `emit_event` adds a scenario event.
4. Warning rules from the catalog are evaluated against values and events. Numeric rules use activation and clear thresholds; event rules activate when their configured event has occurred. The explanation includes the rule or event identifier.
5. The API returns the snapshot. The browser renders these values and states; it does not contain threshold logic.

**Current implementation detail:** `getSimulationSnapshot` derives the readings again from seed and tick, while recording scenario events and prior numeric indicator states on the mutable session object. The API owns session lifetime and calls the simulator synchronously; it does not run a wall-clock loop. Explicit user advances make replay timing independent of browser timers.

## 3. HTTP surface

| Method and path | Purpose | Current behavior |
|---|---|---|
| `GET /health` or `/api/health` | Service readiness | Returns service name, catalog version, simulation readiness, and `durability` (`in_memory` or `postgresql`). |
| `GET /catalog/vehicles` | Vehicle chooser | Returns fictional profile summaries and capability counts. |
| `GET /catalog/vehicles/{id}` | Vehicle setup | Returns capabilities, subsystem metadata, and scenarios applicable to that profile. No telemetry is returned here. |
| `POST /sessions` | Start session | Accepts `vehicleProfileId`, `scenarioId`, and `seed`; returns the initial snapshot. |
| `GET /sessions/{id}` | Read current session | Returns the latest stored snapshot. PostgreSQL sessions survive API restarts. |
| `POST /sessions/{id}/advance` | Advance explicitly | Accepts `ticks` from 1 to 1000, bounded by the scenario duration. |
| `POST /sessions/{id}/report` | Save report | Stores the current snapshot and marks the session saved. |
| `GET /reports` | List reports | Lists reports from the configured repository. |

Errors use JSON `{ error: { code, message } }` responses. Catalog routes are read-only; session creation, advancing, and report saving are the supported POST operations.

## 4. File-by-file low-level responsibilities

### Domain, catalog, and simulation packages

| File | Responsibility and call relationship |
|---|---|
| `packages/domain/src/index.ts` | Zod schemas and inferred TypeScript types for signals, profiles, warning rules, scenario actions, catalog data, capabilities, catalog responses, and health. It is the shared vocabulary; it contains no runtime behavior. |
| `packages/catalog/data/catalog-seed.json` | Versioned fictional source of truth for subsystem IDs, 30 signals, three profiles, rules, and scenarios. Extend this file to add fictional catalog entries; maintain capability, profile, rule, scenario, and event references consistently. |
| `packages/catalog/data/manual-observations.json` | Non-executable research notes. Runtime catalog code deliberately does not import this file. |
| `packages/catalog/src/registry.ts` | `parseCatalog` checks schemas, duplicate IDs, references, supported signal assignments, scenario ordering/ranges, and event applicability. `createRegistry` exposes detached vehicle summaries, capabilities, and profile-specific scenario lists. |
| `packages/catalog/src/index.ts` | Loads the JSON seed, exports the validated catalog and the default registry, and re-exports registry construction helpers. The API imports these defaults. |
| `packages/catalog/src/registry.test.ts` | Catalog integrity, reference validation, capability availability, detached response behavior, and scenario applicability regression cases. |
| `packages/simulation/src/index.ts` | Pure generation/rule module plus mutable session state passed by the API. `createSimulationSession` validates inputs; `advanceSimulation` applies bounded explicit tick changes; `getSimulationSnapshot` creates supported readings, applies due actions, records events, evaluates warning rules, and returns a serializable snapshot. The original `createClock`/`advanceClock` remain as clock primitives. |
| `packages/simulation/src/index.test.ts` | Clock safety and simulation cases for deterministic replay, capability gating, EPS and voltage scenarios, validation, bounds, and hysteresis clearing. |

### API and web application

| File | Responsibility and call relationship |
|---|---|
| `apps/api/src/index.ts` | Composition root. Imports catalog and simulator plus the repository contract. `createApi` accepts any `SessionRepository`, routes requests, translates inputs to simulator calls, and returns JSON with no-store/security headers. `handleRequest` is the portable in-memory fetch handler. |
| `apps/api/src/session-repository.ts` | Serializable session/report records, repository interface, and the explicit in-memory adapter. It has no Node or database dependencies. |
| `apps/api/src/postgres-session-repository.ts` | PostgreSQL implementation; persists session state transactionally with snapshot JSON, individual signal readings, indicator states, events, and reports. Also applies the versioned migration at API startup. |
| `apps/api/db/migrations/001_initial.sql` | PostgreSQL schema for simulation sessions, snapshots, telemetry, emitted events, indicator states, reports, keys, constraints, and indexes. Catalog seed data is intentionally not duplicated into these mutable history tables. |
| `apps/api/src/dev.ts` | Node-only HTTP adapter bound to loopback. Loads local `.env`, optionally connects to PostgreSQL and applies migrations, converts Node requests to Web `Request`, invokes the handler, then writes the Web `Response`; closes the pool on shutdown. Keep Node/pg APIs out of domain/catalog/simulation packages. |
| `apps/api/src/index.test.ts` | Contract cases for health/catalog routes, capability truthfulness, request errors, session lifecycle, profile filtering, report history, and invalid advances. |
| `apps/web/src/main.tsx` | React application. Loads health, vehicle summaries, and selected vehicle details; allows profile/scenario/seed selection; sends session commands; and renders current readings, indicators, explanation text, events, and report-save status. UI requests API data rather than implementing warning thresholds. |
| `apps/web/src/styles.css` | Responsive layout, forms, tables, cluster cards, warning states, and small-screen behavior. Contains presentation only. |
| `apps/web/index.html` | Vite document shell and React mount point. |
| `apps/web/vite.config.ts` | Vite React config and `/api` proxy to the local API for development/preview. |

### Workspace, scripts, and design records

| File | Responsibility |
|---|---|
| `package.json` | npm workspace root and commands for development, local PostgreSQL lifecycle (`db:up`/`db:down`), typecheck, test, build, and preview. |
| `package-lock.json` | Locked dependency graph for reproducible npm installation. |
| `packages/*/package.json`, `apps/*/package.json` | Workspace package names, exports, build/dev scripts, and internal dependencies. API depends on catalog, domain, and simulation; simulation depends only on domain. |
| `tsconfig.json` | Strict TypeScript configuration shared by workspace packages. |
| `vitest.config.ts` | Vitest setup and workspace test discovery. |
| `scripts/dev.mjs` | Starts the API and Vite as child processes and stops both together. |
| `compose.yaml` | Local PostgreSQL service bound to loopback with a named data volume and readiness check. |
| `.env.example` | Documents local API port and optional `DATABASE_URL`; copy to untracked `.env` to enable PostgreSQL. |
| `docs/decisions/ADR-001-foundation.md` | Original catalog-driven modular architecture decision. |
| `docs/decisions/ADR-002-local-foundation-runtime.md` | Web-standard API and local runtime choices. |
| `docs/decisions/ADR-003-simulation-slice.md` | Deterministic local simulation and intentionally temporary in-memory report decision. |
| `docs/FOUNDATION_DESIGN.md` | Broader product boundary, simulation principles, warning and replay design goals, and future scope. |
| `docs/testing/FOUNDATION_TEST_PLAN.md` | Test cases, review gate, review approvals, manual browser cases, and observed execution results. |
| `docs/research/MANUFACTURER_MANUAL_REVIEW.md` | Manufacturer source coverage and evidence limitations; not an executable rules source. |
| `evidence/README.md` | Dated record of implementation scope, checks, and limitations. |
| `README.md`, `AGENTS.md` | User-facing project summary/run instructions and repository-specific contributor/testing guidance. |
| `.env.example`, `.gitignore` | Environment variable example and exclusions for secrets/build outputs/local files. |

## 5. Dependencies and change rules

```mermaid
flowchart TD
  Domain[domain]
  Catalog[catalog]
  Simulation[simulation]
  API[API]
  Web[web]
  Catalog --> Domain
  Simulation --> Domain
  API --> Domain
  API --> Catalog
  API --> Simulation
  Web --> Domain
```

- Put new shared request/response structures in `packages/domain/src/index.ts`.
- Put fictional sensor metadata, capabilities, thresholds, and scenario actions in `catalog-seed.json`; keep runtime validation in `registry.ts`.
- Keep value generation, action execution, and warning transitions in `packages/simulation`; do not copy this logic into React or HTTP routes.
- Keep URL parsing, request validation, status codes, and repository coordination in the API composition boundary. Database-specific code belongs in the API adapter only.
- Keep display labels and UI state in the web app. The web client may format simulator output, but must not invent readings or decide warnings.
- Preserve the synthetic/fictional notice and do not mix manufacturer observations into executable rules.

## 6. Deliberate gaps and next design steps

- **Persistence:** local PostgreSQL now stores mutable sessions, snapshots, telemetry values, warning states, events, and reports. The API applies ordered migrations on startup. The default in-memory adapter remains ephemeral. Catalog definitions still come from versioned JSON; sessions record `catalog_version`, but historical catalog releases are not yet retained or replayed. Retention policies, hosted database provisioning, backups, and production access controls remain future work.
- **Cluster projection:** the current cluster is rendered directly in `main.tsx` from snapshots and a short reading list. A future projection module should map profile-specific slots and unsupported capability states without moving warning logic into UI code.
- **Coverage:** current catalog contains 7 scenarios; broader diagnostics and the planned 10+ cases remain unfinished.
- **Browser automation:** Playwright is not installed. New simulation UI flows have manual acceptance cases but have not yet been observed in a browser.
- **AI:** no OpenAI client is present or required. If added later, it should consume saved synthetic evidence and never generate authoritative telemetry or rule states.
- **Vehicle interaction:** no real OBD/CAN/ECU connection, vehicle control, OEM calibration, certified diagnostic, or repair recommendation exists in this architecture.
