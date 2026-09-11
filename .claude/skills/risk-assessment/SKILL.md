---
name: risk-assessment
description: Decide how much testing a change or feature deserves, and defend the decision. Use when scoping test effort, when asked "what could go wrong here", or before committing to coverage depth. Not for deciding what specifically to test (test-design).
---

Everything cannot be tested. Deciding what _not_ to test is the job; risk is how that
decision is defended when something later escapes.

## When to use

- Scoping effort for a feature or release
- `test-design` step 3 needs risk levels
- Justifying to someone why an area is or is not getting attention

## When NOT to use

- Trivial, isolated change → say so and move on
- You already know the risks and need scenarios → `test-design`
- Assessing a specific diff's QA depth → `triage`

## Operating rules

- **Score before designing.** Scoring afterwards rationalises whatever you already
  wrote.
- **A high risk with no coverage is a finding**, not a quiet gap. It belongs in the
  gate verdict as an accepted risk, visible to whoever ships.
- **Defect history beats intuition.** An area that has broken twice will break again.

## Procedure

### 1. Find the risks — walk the dimensions

Do not brainstorm. Walk the checklist and flag what applies; the dimensions are how
risks get _found_, and scoring only works on risks you have already noticed.

**Requirements and knowledge**

- Are the acceptance criteria vague, incomplete, or contradictory?
- Multiple interacting conditions, or cross-feature dependencies?
- Is this area unfamiliar to whoever is building it?
- Are real users unavailable, so we are testing against assumptions?

**Technical and architecture**

- Does the existing architecture support this, or is it being bent?
- Is this area known to be fragile, or overdue for refactoring?
- New patterns, new integrations, non-trivial implementation?
- Third-party dependency? If so: rate limits, caching, retry behaviour, and what
  happens when it is called in a loop.

**Change and dependency**

- Recently modified? Recent change is the strongest single regression predictor.
- Missing test data, environments, or documentation?
- Blocked on another team's deliverable?

**People and process**

- Pressure to cut testing short?
- Several teams and handoffs involved?
- Nobody available to answer questions or make the call?

**Non-functional** — ask explicitly, because these get skipped when attention is on
behaviour: accessibility (can it be operated by keyboard? contrast? screen reader?) ·
security (auth, external input, money, personal data?) · performance (load, response
time, new queries on large tables?) · data integrity (can this corrupt or lose data?).

Then state each flagged risk **specifically**. "The invoice total is wrong when a
discount and a refund apply to the same line" is a risk. "Billing might break" is a
worry, and cannot be tested or scored.

**Produces:** a flagged, specific risk list.

### 2. Score impact × likelihood

**Impact** — 3: loses money, data, or trust · 2: blocks a workflow, workaround exists ·
1: cosmetic.

**Likelihood** — 3: changed this release, complex, or has broken before · 2: touched
indirectly · 1: stable for a long time.

| Score | Depth                                                                 |
| ----- | --------------------------------------------------------------------- |
| 6–9   | Automated happy path, boundaries and negatives, plus exploratory time |
| 3–4   | Automated happy path plus the highest-value negative                  |
| 1–2   | Smoke only, or consciously untested and recorded as such              |

Two scores make the decision arguable in a way a single "high/medium/low" does not.

### 3. Ask the non-functional question explicitly

_Are there performance, security, accessibility, or data-integrity risks here?_ This
gets skipped when attention is on functional behaviour, and it is where the expensive
escapes live.

### 4. Record it

Write the scores and the reasoning into `apps/<app>/coverage.md`, next to what was
covered. The next person inherits the reasoning, not just the conclusion — and can
challenge it when the context changes.

## Decision points

| Situation                       | Action                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| Everything scores high          | You are not discriminating. Re-score relatively — what is _most_ at risk?               |
| Nothing scores above 2          | Say so and keep testing light. That is a legitimate outcome.                            |
| High score, no time to cover it | Do not silently skip. Record it as an accepted risk so the gate reports CONDITIONAL.    |
| Team disagrees on a score       | The disagreement is the finding — it usually means the feature's purpose is not shared. |
| No defect history available     | Weight complexity and recency higher, and say the history was unavailable.              |

## Interlaying (blind spot)

Risk scoring is a judgement dressed as a number, and it is systematically blind to what
nobody thought of — the unknown risk scores zero because it is never listed. Pair with
`exploratory-session`, whose entire purpose is finding the unlisted. It also measures
_probability of failure_, not _cost of testing_: a low-risk area that is trivially
cheap to cover is still worth covering.

_Lineage and licences: `docs/sources.md`._
