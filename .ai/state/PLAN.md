# PLAN — where we are and what is next

Regenerated at each end gate, never hand-patched. Status and next actions live
together because they are one sentence: what is true now decides what comes next.

Durable working agreements live in `HANDOFF.md`. Facts about an app under test live
in that app's `README.md`. Why a line of code exists lives in a comment next to it.
None of that belongs here.

**Checked:** 2026-09-10, commands re-run at the gate.

## Where we are

Clean tree, pushed. Three commits landed 2026-09-10: `5ad1a7b` scanner re-centred on
identify and interact, `d0c16c0` rules of engagement, `7951117` definition of done.
Each was verified to build and pass on its own. CI green — run 34460682606.

## Proven (direct evidence, re-run at this gate)

- `npm test` **166 passed** · `npm run test:external` **22 passed**
- `npm run gate` **PASS** · `npm run assert-quality` **16 files, 0 findings**
- `npm run mutate` **22/22**, after five new mutations were added and two survived
  first time — one rule was untested, one was masked by a rule behind it
- `npm run check` clean
- Scanner re-centring verified on a real app: the countdown timer went from a finding
  per element to two, both real — the defect a role previously found by hand
- Environment gating verified in **both** directions: a prod-policy log contains no
  payload text; the local log does
- Occlusion detection verified in both directions: fires on a real overlay naming the
  culprit, silent on two known-good pages

## Not proven — do not claim otherwise

- **No exploratory session has ever been run.** Skill, role and checklist all exist;
  none has been exercised. The largest unproven claim in the repo.
- **Self-healing does not exist** in any form. Blocked on E3.
- **Framework detection is ~92% unverified** — see D1.
- Five of seven roles have never run. No role has written a _browser_ spec.
- No skill has been invoked by name.

## The exploration loop — the current thread

Exploration is **interact → observe → hypothesise → test the hypothesis**. Scanning and
logging are tooling that supports it; heuristics and session reports are separate tools
that also support it. All are needed.

**Order of work: D1 → E3 → E4 → E5 → E6 → E7.** D1 first because E3 builds on detection
that is currently unverified, and finding it wrong afterwards is expensive.

| #   | Stage                     | State                                                                                                                                                                                          | Blocked by |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| E1  | **Observe**               | DONE — stack profile, affordances, input constraints, observable state, data dictionary from captured traffic                                                                                  | —          |
| E2  | **Rules of engagement**   | DONE — session-start checklist plus an enforced policy; body capture gated by environment                                                                                                      | —          |
| E3  | **Identity + matcher**    | **NOT BUILT — the keystone.** One scorer answers "are these two observations the same element?", and that primitive serves self-healing, fuzzy matching, drift detection **and** state-diffing | nothing    |
| E4  | **Heuristics**            | NOT BUILT — trigger→move pairs. The cure for the weakness the skill already names: an agent reports a clean session because it never tried anything surprising                                 | nothing    |
| E5  | **Interact** (the driver) | NOT BUILT — action selection under E4, obeying E2, diffing via E3; emits a state graph and an `unexplored` list carrying the reason each control was skipped                                   | E3, E4     |
| E6  | **Session report**        | NOT ENFORCED — the skill asks for observations/questions/defects/not-reached and nothing checks it. Route through `check-report`                                                               | nothing    |
| E7  | **A real session**        | NOT RUN — the empirical test of whether any of the above is enough                                                                                                                             | E5, a key  |

## Architecture gaps

| #   | Gap                                   | Detail                                                                                                                                                                                      |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **No accumulation**                   | Scans overwrite and no code reads one back. Every session is first contact; no baseline for healing, no drift detection                                                                     |
| A2  | **No provenance**                     | A spec does not record which scan it was authored against, so a break has no "before" to compare against                                                                                    |
| A3  | **Drift detection**                   | Falls out of E3 nearly free: diff live scan against committed scan and fail _before_ the suite, reporting "Save was renamed to Submit" instead of thirty timeouts                           |
| A4  | **Healing must propose, never apply** | A silently re-targeted selector can pass against the wrong element — the failure `assert-quality` exists to prevent. Emit a candidate with score and matched signals as `inferred` evidence |

## Self-audit against `docs/definition-of-done.md`

| #   | Gap                                     | State                                                                                                                                                                                       |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Framework detection is ~92% unverified  | OPEN — 13 detectors written, one (jQuery) confirmed live. React, Vue, Angular, Svelte, Next, Nuxt, Remix, SvelteKit, Alpine, htmx, Turbo, AngularJS are **untested claims in shipped code** |
| D2  | `stack.ts` and `probe.ts` have no tests | OPEN — `formatStack` and `stackAdvice` are pure and testable today; detection needs fixture pages. Closes alongside D1                                                                      |
| D3  | Shadow DOM declared, not traversed      | OPEN — reported as `unscanned-shadow-root`, which meets the blind-spot bar but not the coverage one                                                                                         |
| D4  | Scan artefacts are write-only           | OPEN — same as A1                                                                                                                                                                           |
| D5  | `actionAllowed` is never called         | OPEN — tested and unused until E5 exists. Ready, not active                                                                                                                                 |

## Open — carried forward

| #   | Item                                                       | Why it is open                                                                                                                                                       | Blocked by          |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 3   | **Recipes** — 9 multi-phase workflows                      | The orchestration layer; 0 of 9 ported                                                                                                                               | needs the agents    |
| 4   | **Agent contracts** — 7 of 22                              | The seven cover every test level; missing delivery-orchestrator, code-reviewer, release-gate-reviewer, requirements-analyst                                          | nothing             |
| 8   | **LICENSE**                                                | Public repo has none — legally unusable                                                                                                                              | **user's decision** |
| 10  | `apps/todo-fixture/coverage.md`                            | Three skills point at `apps/<app>/coverage.md`; only countdown-timer has one                                                                                         | nothing             |
| 11  | **Analyzer blind to Page Objects**                         | `navigation-only` fires on PO-based tests because the interaction reads `exam.clickNext()`, not `.click(`. Found against mcpa-bot; our own specs barely use POs      | nothing             |
| 12  | Polish — CI badge, topics, CONTRIBUTING, .nvmrc, CHANGELOG | —                                                                                                                                                                    | nothing             |
| 13  | Mutation testing as a debugging **skill**                  | `npm run mutate` is a tool; make it something agents reach for when asked whether tests prove anything                                                               | nothing             |
| 14  | Fresh-clone verification                                   | `npm ci` → browsers → all suites. Proves it works for someone who is not us                                                                                          | nothing             |
| 15  | Trust tier 3 — evals with a pass rate                      | Everything is tier 2 at best                                                                                                                                         | nothing             |
| 16  | Auth / storageState setup project                          | Conspicuous absence to a practitioner                                                                                                                                | an app with a login |
| 17  | Flake detection feeding the gate                           | Skill exists; no tool                                                                                                                                                | nothing             |
| 18  | Regression selection, quality metrics                      | No suite history to act on yet                                                                                                                                       | a real project      |
| 19  | Schemas: requirements-analysis, triage-report              | verdict ported; these two not                                                                                                                                        | nothing             |
| 20  | CI actions target Node 20                                  | GitHub is force-migrating runs to 24. A `@v5` bump clears the annotation                                                                                             | nothing             |
| 21  | **mcpa-bot blind benchmark**                               | Their suite is the reference answer. Point `e2e-coder` at the running app _without_ letting it read `e2e/`, then diff coverage. Reading their tests measures copying | E5, a key           |
| 22  | Review browser-automation-with-pydantic-ai                 | User-supplied, flagged post-main-task                                                                                                                                | after the loop      |

## Recently closed

| Item                                    | Outcome                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Four state files with overlapping jobs  | **DONE** — two. Volatile plan here, durable agreements in `HANDOFF.md`               |
| Validate a writing role                 | **DONE** — `api-coder` wrote `authors.api.spec.ts`; it runs, passes, clears the gate |
| Scanner organised around test ids       | **DONE** — re-centred on identify / interact / observe                               |
| Network bodies collected then discarded | **DONE** — `schema.ts` infers a data dictionary                                      |
| No frontend detection                   | **DONE** — `stack.ts`, each signal naming its evidence                               |
| Definition of done for harness work     | **DONE** — `docs/definition-of-done.md`                                              |
| `.ai/` hidden by `.gitignore`           | **DONE** — un-ignored; new state files are no longer silently skipped                |

## Plans change; facts go stale

Two kinds of content live here and only one is at risk.

**Plans are meant to change.** E3 only became the keystone once it was clear that
self-healing, fuzzy matching, drift detection and state-diffing are one primitive.
That is the plan working, not rotting.

**Statements of fact go stale, and that is the hazard.** This file has claimed a role
was unvalidated after it was validated. The cost is concrete: someone resuming redoes
finished work. So anything asserting what _is_ true carries the date it was checked
and is re-checked at the gate rather than recalled.
