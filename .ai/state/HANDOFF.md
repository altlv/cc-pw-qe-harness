# HANDOFF — restart packet

Written 2026-09-10. Continue from here without the conversation.

## What we are doing

Building `cc-pw-qe-harness` — Claude + Playwright + QA/QE practice. The repo is public
and the user has pushed their own squashed launch commit. **They own every commit and
push now: do not commit unprompted, and never push.** Reach a coherent point, say what
it would contain, and let them decide.

## Agreed priority

**D → B → A → C1 → E.** D (goose inheritance) done. B (honesty/accountability) largely
done — see below. A absorbed into B. C1 done (`apps/fakerestapi`). E is polish.

## Test levels — all five now exist

| Level | State |
| --- | --- |
| unit | `unit` project — pure logic, no I/O |
| integration | `integration` project — real CLIs, real exit codes |
| api | `src/fixtures/api.ts` — todo-fixture and fakerestapi |
| e2e | `src/fixtures/harness.ts` — auto network capture |
| exploratory | skill + role; **no worked session yet** |

One runner covers all of it: Playwright only starts a browser when a test asks for
`page`.

## What is proven (direct evidence)

- 123 local tests + 14 external. Gate PASS. `npm run check` clean.
- **Mutation score 17/17** — `npm run mutate` breaks seventeen rules the harness
  claims to enforce and the suite catches every one.
- **The triage agent runs against the live API.** Classified a 403 failure as
  `infrastructure`, high confidence, citing the real evidence. $0.0998.
- **Role `testability-reviewer` runs end to end and its claims are true.** 10 turns,
  $0.2388, 95s. Every number it reported matches `apps/countdown-timer/scans/timer.json`
  exactly, and it named all five ids and six link labels — values only obtainable by
  actually running the scan. It then found two defects the scanner cannot see (no
  `aria-live` on the display, no state attribute on any button), both verified
  independently against the live page. Its report passes `npm run check-report`.
- Budget stop works: a run that exhausts `maxTurns` returns a partial result saying so,
  rather than crashing.

## What is NOT proven — do not claim otherwise

- **Only two of seven roles have ever run** (`testability-reviewer`, plus the triage
  agent which is not in `roles.ts`). The five coder/explorer roles are unexecuted.
- **No role has written code that was then run.** `testability-reviewer` is read-only.
  The real test of `e2e-coder` / `api-coder` is a spec that passes and survives
  `assert-quality`.
- **The CI workflow has run once and failed**, then was fixed and confirmed green by
  the user. It has not run since the integration level and roles landed.
- **No skill has been invoked by name.** The roles reference skills in their prompts;
  whether that changes behaviour is untested.

## Credentials

A 3-hour API key was supplied on 2026-09-10 and written to `.env` (gitignored,
verified absent from every tracked file). **It is in the chat transcript, so it should
be revoked once expired.** `.env` also holds deliberately empty keys for other
providers — the user set those to observe how bad keys are handled; do not "fix" them.

`src/env.ts` loads `.env` via Node's own loader. Before it existed, nothing read the
file at all and documented variables were silently ignored.

## Still missing from the goose inheritance

- **Recipes: 0 of 9.** The orchestration layer. Format in
  `goose-harness/recipes/new-feature.yaml`; the `delivery-orchestrator` contract
  documents execution. The agents it needs now exist.
- **Agent contracts: 7 of 22**, though the seven cover every test level.
- Schemas: verdict ported; requirements-analysis and triage-report not.

## Next actions, in order

1. **Validate a writing role** — `api-coder` against `apps/fakerestapi`, or
   `e2e-coder` against `countdown-timer`. Success means: the spec it writes runs,
   passes, and clears `assert-quality`. Needs a working key.
2. **Recipes** — port the multi-phase format now the agents exist.
3. **Exploratory session** — run the role for real and keep the debrief.
4. **CI re-run** before the next launch commit.
5. **LICENSE** — the user's decision. Public repo still has none.

## What must not be assumed

- Do not commit unprompted. Never push.
- Do not assert on shared collection sizes, or share an output path between parallel
  tests. Both have caused flakes here.
- Write invisible characters as escapes, and use a script file rather than a shell
  heredoc for anything containing escapes. Heredocs have corrupted files three times.
- A green suite is not evidence the assertions are good — run `npm run mutate`.
