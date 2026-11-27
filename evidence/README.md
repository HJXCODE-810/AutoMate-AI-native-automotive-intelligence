# Foundation implementation evidence

Date: 2026-11-25 (Asia/Kolkata).

## Starting state and scope

GitHub PR #1 was observed closed and merged into `main`, with merge commit `622f0ce0fa394828a4be1315562c60b8ef86162b`. Local main was fast-forwarded, and work continued on `codex/runnable-foundation`. The user authorized a runnable foundation and then required Review Agent review of test cases before execution.

Implemented: npm workspace, strict TypeScript, React vehicle selector, read-only health/catalog API, Zod validation, capability registry, and a pure clock boundary. No API credits were consumed; no OpenAI runtime integration is implemented.

## Test design review

A Review Agent performed static review before test execution. First review found weak scenario error assertions, missing lower-threshold rule coverage, insufficient profile-count checks, and an uncontrolled browser race procedure. A second review found an event-rule fixture dependency accidentally removed from a positive test. Those cases were corrected, and the final static review explicitly approved execution. The reviewer did not run tests or build commands. See [the cases and review record](../docs/testing/FOUNDATION_TEST_PLAN.md).

## Actual verification

| Check | Observed result |
|---|---|
| `npm.cmd run typecheck` | Passed |
| `npm.cmd test` | 57 passed across 3 files; first observed suite duration 1.08 seconds |
| Reviewed CAT-07 regression update | Two additional cases approved before execution; after validator fix, typecheck passed and 59 tests passed across 3 files (604ms) |
| Web production build | Passed; Vite emitted HTML, CSS, and JavaScript |
| API production build | Passed on retry with approved elevated execution; initial sandbox run was denied directory access |
| Final `npm.cmd run build` | Passed end-to-end after event/profile fix with approved elevated execution: typecheck, web build, and API bundle |
| Local API `/health` | Returned status ok, catalog 0.1.0, simulation not_implemented |
| Browser checks | WEB-01 through WEB-04 and WEB-06 through WEB-08 observed; WEB-05 unexercised |

Dependency installation initially hit sandbox network EACCES and was retried with approval. PowerShell blocked `npm.ps1`; commands used `npm.cmd` without changing execution policy. An initial dev launch found port 5173 occupied. The existing local app was inspected; after its services stopped, owned web/API sessions were started for the offline/retry acceptance case.

Final source review found missing profile applicability on event-based scenarios. Two regression cases were written, statically reviewed and approved, then the validator was updated to union applicable profiles from event rules and check every scenario profile. The resulting 59-case suite passed. The revised one-command launcher was also started successfully; direct API health and the proxied vehicle list returned status ok and all three profiles. Owned preview processes were stopped after verification.

## Evidence limitations

- Current tests cover a clock primitive, not seeded telemetry determinism or fault-warning execution.
- Browser checks are manual observations, not an installed Playwright suite. Controlled stale-response behavior remains unchecked.
- GitHub Actions configuration is added; a remote CI run has not been observed.
- Build outputs are local. No Site, database, runtime secret, paid service, or production deployment was created.
- No implementation commit or PR was created in this session; source changes are available for review in the working tree.
- Model and reasoning effort selections were not independently recorded; no model comparison, token usage, or cost measurements are claimed.

## First simulation slice

Date: 2026-11-26 (Asia/Kolkata).

Implemented after the Day 2 foundation: seeded synthetic readings, scenario execution, EPS/ABS/low-voltage warnings with deterministic rule references, explicit session advancement, and in-memory report saving. The web app exposes vehicle/scenario selection, a replay seed, the instrument cluster, indicators, signal readings, and report action. ADR-003 records the process-local storage decision and its restart limitation.

| Check | Observed result |
|---|---|
| `npm.cmd run typecheck` | Passed after the simulation/API/UI changes |
| `npm.cmd run build` | Passed; Vite web build and portable API bundle completed |
| Direct API smoke flow | Created compact EPS session (201), advanced to tick 10 (200), observed active EPS warning and `eps_assist_fault`, saved report (201, `savedReport: true`) |
| Vitest suite | Review Agent approved SIM-01..SIM-07 and API-SIM-01..API-SIM-03. Final `npm.cmd test` passed: 69 tests across 3 files (594ms). First run exposed a case-sensitive error-message regex; it was fixed, re-reviewed, then the suite passed. |
| Typecheck | `npm.cmd run typecheck` passed after adding the simulation/API cases. |
| Persistence | At that point process-local only; this limitation was addressed in the Day 3 persistence work below. |

## Day 3 PostgreSQL persistence

Date: 2026-11-27 (Asia/Kolkata).

Added a `SessionRepository` boundary with an in-memory implementation and a PostgreSQL adapter. PostgreSQL stores session replay state, per-tick snapshot JSON, typed JSONB telemetry values, warning states, scenario events with scheduled event ticks, and saved reports. Added migration `001_initial.sql`, a loopback-only Compose database with named volume, optional `DATABASE_URL`, startup migration, and UI/API durability labels. Catalog definitions and thresholds remain in the reviewed fictional JSON seed.

| Check | Observed result |
|---|---|
| Review Agent test design review | Approved API-SIM-04, SIM-08, and revised API-01 durability contract assertion before final execution; no remaining findings. |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run build` | Passed; Vite web build and portable API bundle completed. |
| `npm.cmd test` | Passed: 71 tests across 3 files (553ms). The initial run had two health schema failures; schema and assertion were corrected, reviewed, and the full suite passed on rerun. |
| `git diff --check` | Passed; only Git line-ending conversion warnings were printed. |
| Live PostgreSQL integration | Not run: Docker/Compose and `psql` are unavailable in this environment. Migration execution, restart durability, and direct SQL assertions remain pending. |

The API defaults to process memory until a local PostgreSQL service is configured and `DATABASE_URL` is set. No real vehicle data or thresholds are asserted, and no hosted database was provisioned.
