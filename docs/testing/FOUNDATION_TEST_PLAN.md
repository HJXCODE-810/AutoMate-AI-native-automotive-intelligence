# Foundation test cases and review gate

Date: 2026-11-27. Status: Day 2/Day 3 automated simulation and repository-boundary cases are reviewed and executed; live PostgreSQL integration cases remain unexecuted.

## Required workflow

Author test cases -> Review Agent checks test design -> resolve findings -> review any materially changed cases -> execute approved cases -> record actual results. A source review or a passing typecheck does not establish passing behavioral tests.

The approved cases below cover the Day 2 local foundation and Day 3 deterministic simulation. Database behavior requires PostgreSQL integration coverage before it can be claimed verified. Authentication, live AI, and deployment remain out of scope.

## Automated cases

| ID | Area | Expected outcome | File |
|---|---|---|---|
| CAT-01 | Starter catalog | Three fictional profiles and 30 signal definitions load; known IDs exist | `packages/catalog/src/registry.test.ts` |
| CAT-02 | Duplicate IDs | Duplicated subsystem, signal, vehicle, rule, or scenario ID rejects catalog | Same |
| CAT-03 | Signal schema | Reversed ranges, nominal range outside valid range, unknown unit, empty enums, and nonpositive sample periods reject | Same |
| CAT-04 | References | Missing subsystem, unknown assignment, duplicate/overlapping assignments, and unknown profile reject | Same |
| CAT-05 | Rule validation | Unsupported target, wrong value type, out-of-range threshold, or reversed clearing threshold rejects | Same |
| CAT-06 | Scenario validation | Unsupported target, wrong set-value type, out-of-range ramp, invalid event, unordered/out-of-duration actions, and overlong ramp reject | Same |
| CAT-07 | Event/profile scope | Scenario events reject if any scenario profile lacks applicable event-rule support; support may be combined across multiple scoped rules | Same |
| CAP-01 | Petrol versus EV | Petrol RPM is supported; EV RPM is unavailable; EV SOC is supported; petrol SOC is unavailable | Same |
| CAP-02 | Missing assignment | Known but unassigned signal is unknown/unavailable, never assumed supported | Same |
| CAP-03 | No readings yet | Every returned reading is null; supported signals are not_started and others unavailable | Same |
| CAP-04 | Isolation | Mutating a returned profile, signal definition, or subsystem cannot change later registry responses | Same |
| CAP-05 | Scenario applicability | EV receives only applicable scenarios; unknown vehicle/signal cannot resolve | Same |
| API-01 | Routes and contracts | Health and catalog routes work through bare and /api paths, with validated response contracts | `apps/api/src/index.test.ts` |
| API-02 | Error paths | Unknown route/profile gives 404, malformed percent encoding gives 400, non-GET gives 405 with Allow header | Same |
| API-03 | Provenance boundary | Responses identify fictional/synthetic data, contain no readings, and exclude manual research | Same |
| CLK-01 | Deterministic clock | Same duration and advances produce same time; input clock unchanged | `packages/simulation/src/index.test.ts` |
| CLK-02 | Invalid clock | Negative/fractional/nonfinite values and unsafe integer overflow reject | Same |
| SIM-01 | Replay determinism | Matching profile/scenario/seed/tick produce identical signal values, events, and indicator states | `packages/simulation/src/index.test.ts` |
| SIM-02 | Capability gating and ranges | Only profile-supported values are emitted; generated values match their declared types and valid ranges | Same |
| SIM-03 | EPS fault transition | EPS remains clear before its scenario event, then activates with the configured rule ID and explanation | Same |
| SIM-04 | Voltage and communication faults | EV low-voltage ramp activates the voltage indicator; communication event activates its indicator | Same |
| SIM-05 | Scenario and seed validation | Unsupported profile/scenario pairs, unknown profiles, and invalid seeds reject | Same |
| SIM-06 | Advance bounds | Zero, fractional, excessive, and beyond-duration advances reject | Same |
| SIM-07 | Warning hysteresis | Low-voltage warning activates below threshold and clears only after the configured clear threshold | Same |
| API-SIM-01 | Session lifecycle | Session creation returns a synthetic capability-filtered snapshot; advance and GET return current tick | `apps/api/src/index.test.ts` |
| API-SIM-02 | Saved report history | Saving returns an in-memory report and adds it to report history; session records saved status | Same |
| API-SIM-03 | Session API errors | Invalid profile/scenario/seed, invalid or excessive advances, and missing sessions return errors | Same |
| API-SIM-04 | Repository boundary | A second API handler using the same repository can read the saved current session after create and advance | Same |
| SIM-08 | Crossed event tick | Advancing from tick 0 past a scheduled event records its configured `atTick`, not the later observed tick | `packages/simulation/src/index.test.ts` |

## Browser acceptance cases (manual, no Playwright dependency yet)

| ID | Steps | Expected outcome |
|---|---|---|
| WEB-01 | Open local app with API running | Health displays connected, three fictional profiles appear, simulation-only label is visible |
| WEB-02 | Select petrol, EV, then diesel | Selected heading/counts and capabilities match each profile; selection is keyboard-accessible |
| WEB-03 | Select EV and search engine.rpm; select unavailable filter | RPM shows unavailable and no number; no gauge implies live measurements |
| WEB-04 | Search nonexistent signal, then clear | Empty result explanation appears; clearing restores rows |
| WEB-05 | In a test-only reverse proxy, hold the petrol-detail response for 1500ms and release the EV response immediately. Select petrol, then EV before releasing petrol. Observe after both requests finish or the earlier request is aborted. | Heading and rows remain EV; stale petrol data never replaces them. If controlled delay tooling is unavailable, record this case as unexercised, not passed. Ordinary rapid clicks alone do not establish race coverage. |
| WEB-06 | Open with API stopped, then retry after API starts | Actionable error appears; retry restores data without page reload |
| WEB-07 | Inspect at 390px and desktop widths | Controls remain usable; horizontal table scroll stays within its container |
| WEB-08 | Inspect detail/scenario presentation | Units and fictional range notice are visible; applicable scenarios are selectable in the simulation panel |
| WEB-09 | Start normal sessions for petrol, EV, and diesel using a fixed seed | Supported telemetry appears; unsupported powertrain signals remain absent; same replay inputs reproduce the same values |
| WEB-10 | Run EPS and low-voltage scenarios, advancing to their fault ticks | The matching simulated indicators and deterministic explanations activate; unrelated indicators remain clear |
| WEB-11 | Save a report and inspect confirmation | UI confirms save and identifies the configured durability mode |

## Database cases planned (not yet exercised)

| ID | Area | Expected outcome | Status |
|---|---|---|---|
| DB-01 | Migration | Against a disposable empty PostgreSQL database, start the migration twice and assert `schema_migrations` contains exactly one `001_initial` row and all six application tables exist | Needs live PostgreSQL |
| DB-02 | Durable session lifecycle | Create an EPS scenario with seed 42, advance to tick 10, stop and recreate the API/repository using the same DB, then assert GET returns the complete same tick-10 snapshot; advance the restored session one tick and compare its full deterministic tick-11 snapshot with a fresh replay using the same profile/scenario/seed/session ID | Needs live PostgreSQL |
| DB-03 | Telemetry and indicators | For DB-02 session/tick 10, query `telemetry_readings` and `indicator_states`; assert each returned supported signal has one matching value row and `steering.eps`/`warn-eps-assist-event-v1` is active with the API explanation | Needs live PostgreSQL |
| DB-04 | Reports/events | Save the DB-02 report, query `session_events` and assert `eps_assist_fault.first_tick = 8` despite advancing directly to tick 10, restart API/repository, then assert report history contains the same report ID and snapshot | Needs live PostgreSQL |

## Review record

Simulation cases SIM-01 through SIM-07 and API-SIM-01 through API-SIM-03 were authored on 2026-11-26 and approved by a static Review Agent on 2026-11-26. Review findings added fractional-advance cases and warning hysteresis coverage. The first test run found a case-sensitive message regex mismatch; the corrected assertion was reviewed and approved before the final run. API-SIM-04 and SIM-08 were approved by the Review Agent on 2026-11-27. API-01 health assertions were updated after adding durability to the response schema; the Review Agent approved the corrected expectation before rerun. Database cases DB-01 through DB-04 are specified but await an available PostgreSQL instance for execution. WEB-09 through WEB-11 are proposed manual acceptance cases and remain pending review.

First static review completed by Review Agent on 2026-11-25; no cases executed. Findings: scenario negative assertions needed specific errors and a valid baseline; lower-threshold clearing rules needed coverage; summary counts needed comparison with all three profile detail responses; stale-response browser coverage needed controlled response ordering. A second static review caught a fixture dependency error: replacing all warning rules removed definitions needed by retained event scenarios. That fixture was corrected without executing tests.

Final static review approved the authored automated cases and WEB-01 through WEB-08 for execution on 2026-11-25, with no remaining material findings. The reviewer ran no tests, typecheck, build, or browser cases. A plan approval does not imply any case passed.

## Execution results

Additional source review found that event existence was validated globally without checking applicable profiles. Two CAT-07 regression cases were authored before changing that validation. Review Agent approved both before execution, confirming they isolate applicability and preserve dependencies. The test labels were aligned with CAT-07. The validator was then changed to check the union of event-rule profiles against every scenario profile; initial results below refer to the original 57 cases.

- `npm.cmd run typecheck`: passed after review approval.
- `npm.cmd test`: passed, 57 cases in three files. These check catalog integrity, registry/API contracts, and the clock boundary, not full sensor simulation.
- After the separately approved CAT-07 cases and event/profile validation fix: `npm.cmd run typecheck` passed and `npm.cmd test` passed 59 cases across three files (604ms reported by Vitest). No regression case was run before review approval.
- `npm.cmd run build`: typecheck and web build passed; API bundling was blocked by sandbox directory access. The unchanged API build passed when rerun with approved elevated execution using `npm.cmd run build --workspace=@automate/api`.
- Final `npm.cmd run build` after the event/profile fix: passed end-to-end with approved elevated execution, including typecheck and both application builds.
- WEB-01: observed connected catalog, three fictional profiles, and simulation labeling.
- WEB-02: observed petrol, EV, and diesel selection; diesel selected using Enter, with 23 configured and 7 unavailable signals and loaded catalog version.
- WEB-03: EV `engine.rpm` showed unavailable with an empty reading after search and availability filtering.
- WEB-04: nonexistent search showed an empty result explanation; Clear filters restored 30 rows.
- WEB-05: unexercised; no controlled delayed-response proxy was used. No claim of race coverage.
- WEB-06: observed the catalog error with API intentionally stopped, then started API and used Retry connection to restore data without a page reload.
- WEB-07: inspected 390px and 1440px viewports. At 390px, the table was 630px wide inside an approximately 338px scroll container, and document width did not exceed the viewport. Desktop showed three cards in one row.
- WEB-08: observed units, synthetic range notice, and applicable scenario names in the expanded notes; no scenario-run controls were presented.

Browser checks were performed through the in-app browser against local development services. Screenshots were inspected during the checks. No automated browser suite, GitHub CI run, OEM conformance check, or deployed Site was exercised.

Simulation/API test execution on 2026-11-26:

- `npm.cmd test`: final run passed, 69 tests across three files (594ms reported by Vitest). This includes the approved SIM-01 through SIM-07 and API-SIM-01 through API-SIM-03 cases.
- First run: 68 passed and one failed because the SIM-05 regex was case-sensitive against a capitalized `Seed` error. The expectation was corrected to `/seed/i`, reviewed and approved, then the complete suite passed.
- `npm.cmd run typecheck`: passed after adding the simulation/API cases.

Database/repository test execution on 2026-11-27:

- The Review Agent approved API-SIM-04 (shared repository behavior), SIM-08 (crossed event preserves scheduled `atTick`), and the revised API-01 durability contract assertion before execution.
- First `npm.cmd test` attempt: 69 passed and two health route assertions failed because the newly returned `durability` field was missing from the strict shared health schema. The schema and expectation were updated, reviewed, and approved before rerunning.
- Final `npm.cmd test`: passed, 71 tests across three files (553ms reported by Vitest).
- `npm.cmd run typecheck`: passed after repository, event tick, and durability schema changes.
- `npm.cmd run build`: passed, including typecheck, Vite production build, and portable API bundle.
- `git diff --check`: passed; Git reported only line-ending conversion warnings.
- PostgreSQL integration cases DB-01 through DB-04 were not executed: this environment has neither Docker Compose/Docker nor `psql`; live migration, restart durability, and SQL row assertions remain unverified.
