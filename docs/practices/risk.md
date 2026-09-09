# Risk-based prioritisation

Everything cannot be tested. Deciding what _not_ to test is the job; risk is how
that decision is defended.

## Scoring

`risk = impact × likelihood`, both 1–3, scored per feature rather than per test.

- **Impact** — 3 loses money, data, or trust; 2 blocks a workflow with a workaround;
  1 is cosmetic.
- **Likelihood** — 3 changed this release, complex, or has a defect history;
  2 touched indirectly; 1 stable for a long time.

| Score | Depth expected                                                                    |
| ----- | --------------------------------------------------------------------------------- |
| 6–9   | Automated coverage of happy path, boundaries and negatives, plus exploratory time |
| 3–4   | Automated happy path plus the highest-value negative                              |
| 1–2   | Smoke only, or consciously untested and recorded as such                          |

## Rules

- Score before writing tests. Scoring afterwards rationalises whatever was written.
- A high score with no coverage is a finding, not a gap to leave quiet — it belongs
  in the gate verdict as a risk.
- Defect history beats intuition. A module that has broken twice will break again.
- Record the scores in the app's `coverage.md` so the next person inherits the
  reasoning and not just the conclusion.

## Where this shows up

`npm run gate` reports untested-but-risky areas as `risks`, which produces a
CONDITIONAL verdict rather than a silent PASS. Shipping with a known gap is a
legitimate decision; shipping unaware of it is not.
