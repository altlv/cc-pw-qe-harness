# TODO — the remaining workload

Everything outstanding, so nothing lives only in a conversation.
Priority agreed with the user 2026-09-09: **D → B → A → C1 → E.**

## Open

| #   | Item                                                                       | Why it is open                                                                                                                         | Blocked by                  |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | **Integration level** — app spec exercising modules together, no browser   | User expects unit/integration/API/E2E/exploratory; integration is the one missing level                                                | nothing                     |
| 2   | **Agent roles for unit + integration**                                     | `roles.ts` covers only the top of the pyramid                                                                                          | item 1                      |
| 3   | **Recipes** — port the 9 multi-phase workflows                             | The orchestration layer; 0 of 9 ported                                                                                                 | items 1–2, needs the agents |
| 4   | **Agent contracts** — 4 of 22 ported                                       | Missing: unit-component-test-engineer, investigator, delivery-orchestrator, code-reviewer, release-gate-reviewer, requirements-analyst | nothing                     |
| 5   | **Drive one agent end to end**, emitting a valid report                    | `roles.ts` has never executed; highest-value remaining item                                                                            | valid `claude login`        |
| 6   | **Triage against the live API**                                            | Deterministic half is unit-tested; the round trip is not                                                                               | valid `claude login`        |
| 7   | **CI dry-run before launch**                                               | The workflow has never run; a red badge on the launch commit is worse than none                                                        | nothing                     |
| 8   | **LICENSE**                                                                | Public repo has none — legally unusable                                                                                                | **user's decision**         |
| 9   | **Exploratory tooling**                                                    | Skill exists; no tooling and no worked session to show                                                                                 | nothing                     |
| 10  | `apps/todo-fixture/coverage.md`                                            | Three skills point at `apps/<app>/coverage.md`; only countdown-timer has one                                                           | nothing                     |
| 11  | **C1** — `apps/fakerestapi/` API coverage                                  | User-supplied. POST returns 200, echoes, never persists — a live case for `test.fail()`                                                | after items 1–3             |
| 12  | **E** — CI badge, repo description/topics, CONTRIBUTING, .nvmrc, CHANGELOG | Polish                                                                                                                                 | item 7                      |
| 13  | Mutation testing as a debugging **skill**                                  | `npm run mutate` is a tool; make it something agents reach for when asked "do these tests prove anything"                              | after the five levels       |
| 14  | Fresh-clone verification (`npm ci` → browsers → all suites)                | Proves it works for someone who is not us                                                                                              | nothing                     |
| 15  | Trust tier 3 — evals with a recorded pass rate                             | Everything is tier 2 at best; tier 3 needs ≥3 cases and a measured rate                                                                | nothing                     |
| 16  | Auth / storageState setup project                                          | Conspicuous absence to a practitioner                                                                                                  | needs an app with a login   |
| 17  | Flake detection (`npm run flake`) feeding the gate                         | Skill exists; no tool                                                                                                                  | nothing                     |
| 18  | Regression selection, quality metrics                                      | Not recreated — no diff or suite history to act on yet                                                                                 | a real project              |
| 19  | Schemas: requirements-analysis, triage-report                              | verdict ported; these two not                                                                                                          | nothing                     |
| 20  | Review browser-automation-with-pydantic-ai article                         | User-supplied, flagged post-main-task                                                                                                  | after 1–3, 11               |

## Closed

| Item                                          | Outcome                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/github-api/`                            | **DROPPED** — user decision: GitHub is not a testing site                      |
| Port `pwtest` as a Claude Code skill          | **DONE** — `.claude/skills/pwtest/` + 4 pattern files                          |
| Port `.ai/state` external memory              | **DONE** — this directory                                                      |
| `hasApiKey()` gate blocking agent runs        | **DONE** — removed; the SDK resolves OAuth itself (e06bcaf)                    |
| Recreate the QA skill set                     | **DONE** — 10 skills, chosen by fit (eae69cb)                                  |
| Restore reference content the source had lost | **DONE** — SFDIPOT sub-factors, risk dimensions, bundled probes (fb1f2f3)      |
| One checkable report format                   | **DONE** — `docs/report-format.md`, `npm run check-report`, verified both ways |
| **A** — unit tests for `src/`                 | **DONE** — 46 tests, mutation score 9/9 (51f5178)                              |
| Unit test level                               | **DONE** — `unit` project; one runner covers every level                       |
| `docs/practices/` duplicating skills          | **DONE** — removed, 13 references repointed                                    |
| Broken `patterns/ui-test.md` cross-reference  | **DONE** — path corrected, resolution verified                                 |
| Example report citing a non-existent scan     | **DONE** — scan generated; its numbers match the report's claims               |

## Note on this file

It drifted once already: item A sat "open" after it was finished, and the broken
`ui-test.md` reference was found, said aloud, and never written down. Refresh this at
the end gate rather than from memory — a finding that exists only in a conversation is
a finding that is already lost.
