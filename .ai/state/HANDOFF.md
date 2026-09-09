# HANDOFF — restart packet

Written 2026-09-09. Continue from here without the conversation.

## What we are doing

Building `cc-pw-qe-harness` — Claude + Playwright + QA/QE practice — into something
showable. Public repo `altlv/cc-pw-qe-harness` exists and is **empty**; seven local
commits. **The user owns the launch: squash + push is theirs, never do it.** Local
commits are fine without asking.

## Agreed priority

**D → B → A → C1 → E.** D (goose inheritance) done. B in progress. A largely absorbed
into B. C1 is `apps/fakerestapi/`. E is polish.

## Test levels — the user's stated expectation

The harness must handle **unit / integration / API / E2E / exploratory**.

| Level       | State                                                            |
| ----------- | ---------------------------------------------------------------- |
| unit        | **done** — `unit` project, 46 tests over the harness's own logic |
| API         | done — `src/fixtures/api.ts`, 5 specs on todo-fixture            |
| E2E         | done — `src/fixtures/harness.ts` with auto network capture       |
| exploratory | **skill only** — no tooling, no worked session                   |
| integration | **missing** — nothing between unit and API                       |

One runner covers all of it: Playwright Test only starts a browser when a test asks
for `page`, so no second framework is needed. Add integration as specs in an app
project that exercise modules together without a browser.

## What is proven (direct evidence)

- 56 tests pass: 46 unit, 7 todo-fixture, 3 harness. 6 external (countdown-timer)
  pass via `npm run test:external`.
- **Mutation score 9/9 (100%)** — `npm run mutate` breaks nine rules the harness
  claims to enforce and the suite catches every one. This is the evidence that the
  assertions are real rather than coverage theatre.
- `npm run check` clean: format, lint, typecheck.
- Gate returns PASS on a clean run, FAIL with a blocker on a vacuous test (exit 1).
- `npm run check-report` accepts an honest report, produces 4 errors + 5 warnings on
  a dishonest one (exit 1).
- Network capture proof test: the DOM reports success on a write that returned 500.

## What is NOT proven — do not claim otherwise

- **`src/agents/roles.ts` has never executed.** Four role definitions, zero runs.
- **The triage agent has never called the live API.** Its deterministic half is now
  unit-tested; the round trip is not. Blocked on an expired OAuth session in the
  spawned subprocess — `claude login` may fix it. **Not** an API-key problem; that was
  a bug in our own code, removed in e06bcaf.
- **The CI workflow has never run.** A red badge on the launch commit would be worse
  than no badge.
- **No skill has ever been invoked.** Ten skills, all prose so far.

## Still missing from the goose inheritance

- **Agents: 4 of 22.** Absent and relevant: unit-component-test-engineer,
  investigator, delivery-orchestrator, code-reviewer, release-gate-reviewer,
  requirements-analyst.
- **Recipes: 0 of 9.** The orchestration layer — phases, agent per phase, state
  handoff, verdict aggregation. Format is in `goose-harness/recipes/new-feature.yaml`;
  the `delivery-orchestrator` agent contract documents how they execute.
- Schemas: verdict ported. requirements-analysis and triage-report not.

## Next actions, in order

1. **Integration level** — an app spec exercising modules together without a browser.
   Completes the five levels.
2. **Agent roles for those levels** — unit-test-engineer, integration-tester, so
   `roles.ts` covers the pyramid rather than only its top.
3. **Recipes** — port the multi-phase format. Needs the agents first.
4. **Drive one agent end to end** and have it emit a valid report. Highest-value item
   remaining: it converts `roles.ts` and the skills from prose into something shown.
5. **LICENSE** — the user's decision, not ours. Public repo currently has none.

## What must not be assumed

- Do not push, force-push, or create the launch commit.
- Do not claim the `cc` third is covered while `roles.ts` has never run.
- Do not assert on shared collection sizes in tests — parallel workers share app
  state. This has bitten once.
- Write invisible characters as escapes. A literal U+FEFF has tripped lint twice.
