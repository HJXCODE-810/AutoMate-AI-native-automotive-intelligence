# ADR-001: Catalog-driven modular monolith for the first vehicle slice

- **Status:** Proposed
- **Date:** 2026-11-24
- **Decision owners:** AutoMate OS project owner

## Context

AutoMate OS needs one demoable simulated vehicle dashboard spanning fictional powertrain and segment profiles. The project is starting from a README. The first slice needs a trustworthy way to distinguish available from unavailable signals, deterministic replay, and a safe path to add profiles without mixing vehicle rules into UI code. The project context requires official OpenAI APIs for future AI features, no vehicle control, and explicit synthetic-data provenance.

## Decision

1. Use a TypeScript modular monolith with separate web, API, domain, catalog, simulation, cluster-projection, and persistence modules.
2. Keep a normalized, versioned catalog for vehicle profiles, subsystems, signal definitions, capability assignments, warning rules, and scenarios. Check in JSON seed data and load it through schema validation; pin catalog versions in sessions.
3. Resolve signal availability through explicit per-profile capability assignments. Missing assignments mean `unknown`; unsupported signals never receive synthesized values.
4. Keep the sensor engine and warning evaluator pure, deterministic, and independent of HTTP, UI, database, and AI code. Use explicit ticks and seeded randomness only when needed.
5. Use PostgreSQL for durable catalog/session storage behind repository interfaces. Permit an in-memory adapter only as a temporary local bootstrap if PostgreSQL setup blocks the first dashboard, with the limitation documented.
6. Begin with three fictional profiles: compact petrol, electric SUV, and luxury diesel. Expand profile coverage through catalog data, not brand/model compatibility claims.
7. The first UI is a simulation-labeled cluster with capability-aware gauges, indicators, signal freshness/provenance, scenario controls, and an event timeline.

## Consequences

### Positive

- New fictional vehicles can reuse signal definitions and simulation logic.
- Profile differences are explicit and reviewable.
- Replay and evidence can be tied to catalog/scenario versions.
- The web UI cannot silently invent unavailable sensors or duplicate warning logic.
- Future AI investigation can consume stored facts without owning physics or safety rules.

### Costs and constraints

- Catalog schemas and migrations need versioning discipline.
- Normalization requires more careful seed authoring than a single flat fixture.
- PostgreSQL introduces local setup overhead; the repository interface allows an honest temporary in-memory path.
- “All aspects” is represented as an extensible taxonomy, not as a claim that every starter profile implements every subsystem.

## Alternatives considered

- **One large vehicle JSON object per model:** easy to start, but duplicates signal metadata and makes capability mismatches harder to detect.
- **Signals embedded in UI components:** rejected because warning and availability logic would be inconsistent across screens and scenarios.
- **LLM-generated sensor values:** rejected because output is not reliably reproducible or suitable as simulation ground truth.
- **Microservices:** rejected for the initial slice because deployment and coordination overhead do not improve the single-dashboard goal.

## Revisit when

- Historical imports require a separate ingestion service or storage lifecycle.
- Catalog scale or concurrent simulation load requires measured optimization.
- A verified external integration is proposed; it needs a separate safety, legal, and data-source decision before implementation.
