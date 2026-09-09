# Defect reporting

A bug report is an argument that something is worth someone's time. Reports get
rejected for being unclear far more often than for being wrong.

## Required

1. **Title** — observable effect plus context. "POST /api/todos returns 500 when
   the title contains an emoji", never "todos broken".
2. **Steps** — numbered, starting from a known state, with the actual data used.
3. **Expected vs actual** — separately, and state the oracle for "expected".
4. **Evidence** — network capture, trace, screenshot. `artifacts/` after a failed
   run holds all three.
5. **Scope** — environments and versions where it reproduces, and where it does not.
6. **Frequency** — always, or 3-in-10. An intermittent bug reported as consistent
   gets closed as unreproducible and is then harder to raise a second time.

## Advocacy without exaggeration

Severity is about impact on users, not on your afternoon. Inflating it buys one
fix and spends credibility that the next report needs. If the impact is genuinely
unclear, say what you know and what you would need in order to judge.

Separate the fact from the theory. "The POST returns 403 after ten minutes idle"
is an observation; "the session expires too early" is a hypothesis. Label which is
which — a wrong theory attached to a correct observation gets the whole report
dismissed.

## Triage categories

The harness classifies failures as `product-bug`, `test-bug`, `selector-rot`,
`infrastructure`, or `flaky` (see `src/agents/triage.ts`). Only the first is a
defect in the product. The discipline that matters: never file a test-bug or an
infrastructure failure as a product defect, and never quietly widen a selector to
make a real product-bug disappear.
