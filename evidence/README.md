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
