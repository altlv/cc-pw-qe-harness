# TODO — the remaining workload

Everything outstanding, so nothing lives only in a conversation.
Refreshed 2026-09-10. Definition of done for harness work: `docs/definition-of-done.md`.

## The exploration loop — the current thread of work

Exploration is **interact → observe → hypothesise → test the hypothesis**. Scanning and
logging are tooling that supports it; heuristics and session reports are separate tools
that also support it. All are needed.

| #   | Stage                     | State                                                                                                                                                                                                  | Blocked by |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| E1  | **Observe**               | DONE — stack profile, affordances, input constraints, observable state, data dictionary from captured traffic                                                                                           | —          |
| E2  | **Rules of engagement**   | DONE — session-start checklist plus an enforced policy; body capture gated by environment                                                                                                               | —          |
| E3  | **Identity + matcher**    | **NOT BUILT — the keystone.** One scorer answers "are these two observations the same element?", and that single primitive serves self-healing, fuzzy matching, drift detection **and** state-diffing    | nothing    |
| E4  | **Heuristics**            | NOT BUILT — trigger→move pairs. The cure for the weakness the skill already names: an agent reports a clean session because it never tried anything surprising                                          | nothing    |
| E5  | **Interact** (the driver) | NOT BUILT — action selection under E4, obeying E2, diffing via E3; emits a state graph and an `unexplored` list carrying the reason each control was skipped                                             | E3, E4     |
| E6  | **Session report**        | NOT ENFORCED — the skill asks for observations/questions/defects/not-reached and nothing checks it. Route through `check-report`                                                                        | nothing    |
| E7  | **A real session**        | NOT RUN — the empirical test of whether any of the above is enough                                                                                                                                     | E5, a key  |

## Architecture gaps found 2026-09-10

| #   | Gap                                   | Detail                                                                                                                                                                            |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **No accumulation**                   | Scans overwrite and no code reads one back. Every session is first contact; there is no baseline for healing and no drift detection                                                |
| A2  | **No provenance**                     | A spec does not record which scan it was authored against, so a break has no "before" to compare against                                                                           |
| A3  | **Drift detection**                   | Falls out of E3 nearly free: diff the live scan against the committed one and fail _before_ the suite, reporting "Save was renamed to Submit" instead of thirty timeouts           |
| A4  | **Healing must propose, never apply** | A silently re-targeted selector can pass against the wrong element — the exact failure `assert-quality` exists to prevent. Emit a candidate with its score and matched signals as `inferred` evidence |

## Gaps in today's own work — found by auditing against `docs/definition-of-done.md`

Self-audit run 2026-09-10. The DoD caught six; two are fixed, four remain open.

| #   | Gap                                        | State                                                                                                                                    |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Framework detection is ~92% unverified     | OPEN — detection written for 13 frameworks; exactly one (jQuery) has been confirmed against a live app. React, Vue, Angular, Svelte, Next, Nuxt, Remix, SvelteKit, Alpine, htmx, Turbo, AngularJS are **untested claims** |
| D2  | `stack.ts` and `probe.ts` have no tests    | OPEN — both are browser-dependent. `formatStack` and `stackAdvice` are pure and testable today; detection needs fixture pages             |
| D3  | Shadow DOM declared but not traversed      | OPEN — now reported as `unscanned-shadow-root`, which meets the blind-spot bar but not the coverage one. Playwright locators do pierce open shadow DOM, so traversal is possible |
| D4  | Scan artefacts are still write-only        | OPEN — same as A1. `.json`/`.ndjson`/`.txt` are produced and nothing reads them back                                                      |
| D5  | `actionAllowed` is never called            | OPEN — the policy is tested and unused until the driver (E5) exists. Ready, not active                                                    |
| D6  | Skills contradicted the re-centred scanner | **FIXED** — `testability-audit` and `pwtest` both rewritten                                                                              |
| D7  | New rules had no mutation coverage         | **FIXED** — five mutations added. Two survived, exposing a genuinely untested rule and a redundantly-covered one; both closed, 22/22      |

## Open — carried forward

| #   | Item                                                                      | Why it is open                                                                                                                                                                              | Blocked by          |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 3   | **Recipes** — port the 9 multi-phase workflows                            | The orchestration layer; 0 of 9 ported                                                                                                                                                      | needs the agents    |
| 4   | **Agent contracts** — 7 of 22 ported                                      | The seven cover every test level; missing delivery-orchestrator, code-reviewer, release-gate-reviewer, requirements-analyst                                                                  | nothing             |
| 8   | **LICENSE**                                                               | Public repo has none — legally unusable                                                                                                                                                     | **user's decision** |
| 10  | `apps/todo-fixture/coverage.md`                                           | Three skills point at `apps/<app>/coverage.md`; only countdown-timer has one                                                                                                                | nothing             |
| 11  | **Analyzer is blind to Page Objects**                                     | `navigation-only` fires on PO-based tests because the interaction reads `exam.clickNext()`, not `.click(`. Found by pointing it at mcpa-bot; our own specs barely use POs so we never saw it | nothing             |
| 12  | **E** — CI badge, repo description/topics, CONTRIBUTING, .nvmrc, CHANGELOG | Polish                                                                                                                                                                                      | nothing             |
| 13  | Mutation testing as a debugging **skill**                                 | `npm run mutate` is a tool; make it something agents reach for when asked whether tests prove anything                                                                                       | nothing             |
| 14  | Fresh-clone verification (`npm ci` → browsers → all suites)               | Proves it works for someone who is not us                                                                                                                                                   | nothing             |
| 15  | Trust tier 3 — evals with a recorded pass rate                            | Everything is tier 2 at best; tier 3 needs at least three cases and a measured rate                                                                                                         | nothing             |
| 16  | Auth / storageState setup project                                         | Conspicuous absence to a practitioner                                                                                                                                                       | an app with a login |
| 17  | Flake detection (`npm run flake`) feeding the gate                        | Skill exists; no tool                                                                                                                                                                       | nothing             |
| 18  | Regression selection, quality metrics                                     | No suite history to act on yet                                                                                                                                                              | a real project      |
| 19  | Schemas: requirements-analysis, triage-report                             | verdict ported; these two not                                                                                                                                                               | nothing             |
| 20  | CI actions target Node 20                                                 | GitHub is deprecating it and force-migrating runs to 24. A `@v5` bump clears the annotation                                                                                                 | nothing             |
| 21  | **mcpa-bot blind benchmark**                                              | Their suite is the reference answer. Point `e2e-coder` at the running app _without_ letting it read `e2e/`, then diff coverage. Reading their tests would measure copying, not design        | E5, a key           |
| 22  | Review browser-automation-with-pydantic-ai article                        | User-supplied, flagged post-main-task                                                                                                                                                       | after the loop      |

## Closed since the last refresh

| Item                                    | Outcome                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Validate a writing role                 | **DONE** — `api-coder` wrote `authors.api.spec.ts`; it runs, passes, clears the gate, types clean   |
| CI dry-run before launch                | **DONE** — run 34446271026 green                                                                   |
| Scanner organised around test ids       | **DONE** — re-centred on identify / interact / observe; a missing test id is no longer a finding    |
| Scanner assumed `data-testid`           | **DONE** — uses the attribute actually detected on the page                                        |
| Network bodies collected then discarded | **DONE** — `schema.ts` infers a data dictionary: types, nullable, optional, real samples           |
| No frontend detection                   | **DONE** — `stack.ts`, each signal naming the evidence that proves it                              |
| Scan output shape                       | **DONE** — `.json` structured · `.network.ndjson` the greppable proxy log · `.txt` the digest      |
| Countdown suite gated on a decoy value  | **DONE** — the display ships in static HTML already reading `01:01:12`; the gate now proves it ticks |
| Definition of done for harness work     | **DONE** — `docs/definition-of-done.md`, every item traced to a real failure here                  |

## Note on this file

It has drifted twice: item A sat open after it was finished, and the validated-role and
CI items sat open after being completed. Refresh at the end gate rather than from
memory — a finding that exists only in a conversation is already lost.
