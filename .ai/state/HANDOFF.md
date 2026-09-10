# HANDOFF — restart packet

Written 2026-09-10. Continue from here without the conversation.

## What we are doing

Building `cc-pw-qe-harness` — Claude + Playwright + QA/QE practice. The repo is public
and the user has pushed their own squashed launch commit. **They own every commit and
push now: do not commit unprompted, and never push.** Reach a coherent point, say what
it would contain, and let them decide.

## Current thread: the exploration loop

The user's framing, and the organising principle for the work in flight:

> Exploration is **interaction, observation and hypothesis testing**. Scan logging and
> understanding page structure are tooling that supports it. Session reports and
> heuristics are different tools that also support it. All are needed.

And their definition of testability, which the scanner is now built around:

> the ability to **identify** and **interact with** the available elements and objects,
> **easily enough**.

Test ids were inherited from the tooling, not from that definition. Most apps do not
have them and are testable anyway, so their absence is **not** a finding. What is:
ambiguous (matches several), unaddressable (position only), unreachable (covered,
disabled), unlabelled input, and no observable state.

Stage status is tracked as E1–E7 in `TODO.md`. E1 observe and E2 rules of engagement
are done; **E3 element identity is the keystone and is next** — one scorer answering
"are these two observations the same element?" serves self-healing, fuzzy matching,
drift detection and state-diffing, which are four names for one primitive.

## Uncommitted at handoff (14 paths, all green)

| Area | Files |
| --- | --- |
| Observation | `src/tools/{schema,stack,probe}.ts`, rewritten `src/tools/page-scanner.ts`, `src/cli/scan.ts` |
| Rules of engagement | `src/qe/exploration-policy.ts`, `.claude/skills/exploratory-session/references/session-start-checklist.md`, body gating in `src/capture/network.ts` |
| Alignment | `.claude/skills/testability-audit/SKILL.md` rewritten to match the scanner |
| Process | `docs/definition-of-done.md` — DoD for extending the harness, every item traced to a real failure |
| Tests | `tests/unit/{schema,exploration-policy}.test.ts`, rewritten testability block in `tests/unit/agents.test.ts` |

Suggested single commit: _"Re-centre the scanner on identify and interact, and put
rules of engagement around exploration."_

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

- 159 local tests + 22 external, re-run at the 2026-09-10 end gate. Gate PASS.
  `assert-quality` 0 findings. `npm run check` clean.
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

- **Two of seven roles have run** (`testability-reviewer`, `api-coder`), plus the
  triage agent, which is not in `roles.ts`. `e2e-coder`, `unit-test-engineer`,
  `integration-tester`, `exploratory-tester` and `investigator` are unexecuted.
- **No role has written a _browser_ spec.** `api-coder` wrote a passing API spec that
  clears `assert-quality`, so the write-and-run path is proven at API level only. The
  equivalent test for `e2e-coder` has not been done.
- **No exploratory session has ever been run**, so the skill, checklist and role are
  untested in practice. This is the biggest unproven claim in the repo.
- **Self-healing does not exist** in any form. Blocked on E3.
- **CI has not run since the observation layer landed.** Last green run was
  34446271026, on the previous commit.
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

1. **The user's call on the 14 uncommitted paths.** Nothing else should pile on top.
2. **E3 — element identity and the matcher.** The keystone; key-free. Store redundant
   identity per element (role, name, testid, id, tag, type, ancestors, sibling index,
   nearby text, constraints) and score two observations for sameness. Self-healing,
   fuzzy matching, drift detection and state-diffing all reduce to this.
3. **E4 — heuristics reference**, trigger→move pairs under `exploratory-session`.
4. **E5 — the driver**, then **E6** report enforcement, then **E7** a real session.
5. **Recipes** — port the multi-phase format now the agents exist.
6. **LICENSE** — the user's decision. Public repo still has none.

Done since the last handoff, do not redo: a writing role is validated (`api-coder`
wrote `apps/fakerestapi/tests/authors.api.spec.ts`); CI ran green (34446271026).

## What must not be assumed

- Do not commit unprompted. Never push.
- Do not assert on shared collection sizes, or share an output path between parallel
  tests. Both have caused flakes here.
- Write invisible characters as escapes, and use a script file rather than a shell
  heredoc for anything containing escapes. Heredocs have corrupted files three times.
- A green suite is not evidence the assertions are good — run `npm run mutate`.

## Traps found the hard way, this session

- **A detector that cries wolf is worse than none.** Two of ours did. Always run a new
  rule against a known-good page and confirm silence, not just against the case you
  built it for. `docs/definition-of-done.md` item 3.
- **`document.elementFromPoint` only answers inside the viewport.** Clamping an
  off-screen centre onto the edge samples a different element and invents an overlay.
  Off-screen is not a blocker anyway: Playwright scrolls before acting.
- **No named or const-assigned functions inside `page.evaluate`.** tsx/esbuild rewrites
  them to call a `__name` helper that does not exist in the page; the failure is an
  opaque `ReferenceError`. Keep evaluate bodies inline.
- **A static value can be a decoy.** The countdown display ships in the HTML already
  reading `01:01:12` — exactly what the init script sets — so asserting it proves
  nothing about whether the app is alive.
