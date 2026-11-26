# ADR-003: Deterministic simulation slice with in-memory reports

- Status: Accepted for local educational development
- Date: 2026-11-26
- Builds on: ADR-002

## Context

The catalog foundation had vehicle capabilities and scenario descriptions but no running simulation. The next product slice needs to demonstrate a repeatable flow from a selected fictional profile to telemetry, a fault warning, and a saved report without requiring paid APIs or a database.

## Decision

Keep seeded telemetry generation, scenario actions, warning evaluation, and snapshots in the pure `@automate/simulation` package. Seed plus profile, scenario, and tick produce repeatable values. Warning rules remain catalog data; the simulator adds deterministic explanations that cite the matching rule or event. Unsupported signals are omitted from generated values.

Expose Web-standard session endpoints: `POST /sessions`, `GET /sessions/{id}`, `POST /sessions/{id}/advance`, `POST /sessions/{id}/report`, and `GET /reports`. Bound advances to 1–1000 ticks and the selected scenario duration. EPS, ABS, low-voltage, and existing catalog scenarios are educational fictional cases.

Use a process-local in-memory session/report store for this first slice. The UI and API disclose that reports disappear when the API restarts. This completes a reviewable local flow while leaving durable history to a later storage decision. No real vehicle, diagnostic, or repair claim is made; no OpenAI API is required.

## Consequences

- A local user can start a seeded session, advance explicit ticks, inspect synthetic readings and rule-based indicators, and save an in-memory report.
- Restarting the API discards all sessions and reports. This is not durable persistence and is not suitable for hosted multi-instance use.
- Simulation regression cases must be authored and reviewed before test execution under the repository test gate.
- Next, review replay determinism, warning transitions, API validation, and report behavior; then choose and implement durable storage.
