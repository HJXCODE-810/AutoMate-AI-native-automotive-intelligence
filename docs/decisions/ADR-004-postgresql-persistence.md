# ADR-004: PostgreSQL persistence for simulation history

- **Status:** Accepted
- **Date:** 2026-11-27

## Context

Day 3 needs session and report history that survives API restarts while keeping simulation code deterministic and independent of database clients. The fictional vehicle catalog is already version-controlled JSON and should not be duplicated as mutable database state.

## Decision

Use PostgreSQL for mutable session data behind the `SessionRepository` interface. Keep the in-memory implementation as an explicit local fallback and test adapter. The Node API entrypoint reads `DATABASE_URL`, applies ordered SQL migrations, and injects the PostgreSQL adapter into the Web-standard API handler.

Persist session metadata and replay state, tick snapshots, individual telemetry values, warning indicator states, emitted events, and saved report snapshots. Store full snapshots as JSONB for faithful evidence retrieval, with relational rows and constraints for querying telemetry and warning history. Record the catalog version on each session; keep catalog definitions and thresholds in the versioned seed JSON.

## Consequences

- Local PostgreSQL is optional. Without `DATABASE_URL`, health and API responses report `durability: "in_memory"` and data is lost on process restart.
- With `DATABASE_URL`, startup applies the initial migration and history is durable across API restarts.
- `npm run db:up` and `npm run db:down` manage the local Compose service; its named volume preserves data when stopped.
- Production hosting, backup and retention policy, access controls, and old catalog version retention still need separate design.
- Synthetic values and fictional thresholds remain clearly labeled; database persistence does not turn them into real vehicle measurements.

## Alternatives considered

- **MongoDB:** document storage would fit JSON snapshots, but the project needs queryable tick/signal history, constraints, and session/report relations; PostgreSQL JSONB supports the snapshots while relational tables support those queries.
- **SQLite:** simpler for a single local process, but not the selected persistent service target and less representative of multi-instance hosted deployment.
- **Keep maps only:** simplest, but does not meet the restart-survival requirement.
