# STATUS — current truth

**Updated:** 2026-09-10

## Objective (bounded)

Bring `cc-pw-qe-harness` to a showable state. **The user owns every commit and push** —
do not commit unprompted, never push.

## Agreed priority

**D → B → A → C1 → E.** D done. B largely done — two roles now validated against live
targets. A absorbed into B. C1 done (`apps/fakerestapi`). E is polish.

## Phase

Uncommitted working set, verified green. Awaiting the user's decision on a commit.

## Verified facts (OBSERVED, this session)

- Full suite green — `npm test` and `npm run test:external`; `npm run gate` returns
  PASS; `npm run check` clean.
- `npm run mutate` catches every rule it breaks.
- **Two roles validated end to end against live targets**, claims checked against
  independent sources: `testability-reviewer` (read-only) and `api-coder`, which wrote
  a spec that runs, passes, and clears the quality gate.
- The triage agent works against the live API.
- The budget's stop path works: a run exhausting `maxTurns` returns a partial result
  rather than crashing.

## Not proven — do not claim otherwise

- Most roles have never run. `HANDOFF.md` names which.
- No skill has been invoked by name.
- CI has not run since the integration level and the roles landed.

## Next action

Commit point reached and reported. After that, in order: recipes · validate a role
that writes browser specs (`e2e-coder`) · a real exploratory session · LICENSE, which
is the user's decision.
