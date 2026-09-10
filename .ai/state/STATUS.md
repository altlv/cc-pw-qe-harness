# STATUS — current truth

**Updated:** 2026-09-10

## Objective (bounded)

Build the tooling the exploration loop needs: **interact → observe → hypothesise →
test the hypothesis**. Observation and rules of engagement are done; interaction is
not. **The user owns every commit and push** — do not commit unprompted, never push.

## Phase

Uncommitted working set of 14 paths, verified green. A commit point has been reached
and reported; awaiting the user's decision.

## Verified facts (OBSERVED, this session, commands re-run at the end gate)

- `npm test` → **159 passed**; `npm run test:external` → **22 passed**
- `npm run gate` → **PASS**; `npm run assert-quality` → **15 spec files, 0 findings**
- `npm run mutate` → **17/17**
- `npm run check` clean (prettier, eslint, tsc)
- Scan re-centred on identify/interact/observe: countdown-timer went from a finding
  per element to **2 findings, both real** — the same defect `testability-reviewer`
  found by hand earlier, now falling out of a scan
- Environment gating of payload capture verified **in both directions**: grepping a
  prod-policy log for real payload text finds nothing; the local log retains it
- Occlusion detection verified in both directions: fires on a real overlay naming the
  culprit, silent on two known-good pages

## Not proven — do not claim otherwise

- **No exploratory session has ever been run.** The skill, the role and the checklist
  all exist; none has been exercised. E7 in `TODO.md`.
- **Self-healing does not exist.** Not started, and blocked on element identity.
- Most roles have never run. Two are validated; `HANDOFF.md` names which.
- No skill has been invoked by name.
- CI has not run since the observation layer landed — last green run was the previous
  commit.
- The heuristics reference is not written, so an exploratory session today would rely
  on the agent noticing things unprompted, which the skill itself says it is worst at.

## Next action

**E3 — element identity and the matcher.** It is the keystone: one scorer answering
"are these two observations the same element?" serves self-healing, fuzzy matching,
drift detection and exploration state-diffing. Key-free. Then E4 heuristics, then E5
the driver.

Before that, the user's call on committing the 14 paths.
