---
name: work-discipline
description: Operating discipline for reliable, resumable work in this repo — start gate, bounded objective, evidence rules, failure loop, end gate. Use at the start of any non-trivial task and whenever scope starts drifting.
---

Use this on every non-trivial task. Adapted from a Goose-based harness; the state
model it depends on lives in `.ai/state/`.

## Start gate

1. Read `.ai/state/HANDOFF.md` for how we work here, then `.ai/state/PLAN.md` for
   where the work stands.
2. Run `git status --short --branch`. Look at the shape of the repo before opening
   many files.
3. **Restate one bounded objective.** Extra requests and discoveries go to
   `.ai/state/PLAN.md`, not into silently widened scope.
4. Classify risk: LOW / MEDIUM / HIGH. Anything irreversible, public-facing, or
   security-sensitive is HIGH.

## Work loop

For each bounded item: **inspect → decide → change → verify → record.**

Do not batch unrelated changes. Prefer a deterministic tool over inference — running
the check beats reasoning about what the check would say.

## Truth rules

Disk, command output, and test output are evidence. Conversation memory is not.

Classify every claim — in `PLAN.md`'s proven / not-proven split, and in the
frontmatter of any report (`docs/report-format.md`):

| Type         | Means                            | Requires                                                |
| ------------ | -------------------------------- | ------------------------------------------------------- |
| **direct**   | You observed it                  | A test result, response body, or `file:line`            |
| **inferred** | You deduced it                   | The reasoning chain, shown. "I think" is not inference. |
| **claimed**  | Someone or something asserted it | Marking as unverified, plus what would verify it        |

- **Claimed alone is never sufficient** for a finding. It is where investigation
  starts, not where it ends.
- **Documentation is claimed until checked.** A README describes intent, not
  behaviour. So does a comment, a commit message, and a PR description.
- **UNKNOWN beats plausible invention.** Saying you could not determine something is
  a useful output.

Never say DONE while verification, state updates, or known gaps remain. State
**NOT RUN** explicitly — silence about a skipped check reads as a pass.

**A green check proves only what that check actually covers.** When a claim matters,
verify the checker: write a case you expect to fail and confirm that it does. A
passing test that asserts nothing is a _silent_ failure — it reports success while the
system is broken, and nobody investigates green.

**Your own output is the evidence most in need of checking.** Plausible-looking is not
correct, and you generate plausible-looking far faster than you verify it. Before
reporting a result as observed, confirm the tool actually ran and the output contains
something that could only have come from the real system — a specific count, an id, an
exact string. A report of "all tests pass" that was never executed is claimed evidence
presented as direct, which is the worst error available here.

## Failure loop

Do not repeat a failed action. Diagnose, change approach, retry. Stop after **3
materially different attempts** and escalate with evidence.

If you find yourself explaining why something should work instead of testing whether
it does, stop and test it.

## Scope guard

Flag direction shifts instead of absorbing them. When a new thread appears, say so and
let the human choose: pursue now, park in `PLAN.md`, or treat as part of current work.
Every parked item gets a return condition.

A constraint you invented is not a constraint. Before reporting something as blocked,
check that the blocker is real and external.

## End gate

Regenerate `PLAN.md`: commands actually run and their results, what is proven, what
is not, open gaps, and the exact next action. Re-run the checks rather than recalling
them. Touch `HANDOFF.md` only if a working agreement or trap changed — if you are
updating it every session, something volatile has leaked into it.

The test: could someone continue this work tomorrow with no access to the
conversation? If not, the end gate is not done.

_Lineage and licences: `docs/sources.md`._
