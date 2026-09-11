---
name: flaky-test-detection
description: Diagnose a test that passes and fails without the code changing, find the actual cause, and fix it rather than retrying it away. Use when a test fails intermittently, when CI needs a retry to go green, or before trusting a suite. Not for tests that fail consistently.
---

A test that needs a retry is not evidence. Flake is not noise to be tuned out — it is
the suite telling you it does not know what it is measuring.

## When to use

- A test fails intermittently with no code change
- CI passes only on retry (`retries: 1` in `playwright.config.ts` masks this by design)
- `npm run gate` reports flaky tests as a CONDITIONAL risk
- Before relying on a suite you did not write

## When NOT to use

- The test fails every time → it is a defect or a test bug, not flake
- The app itself is non-deterministic by design → that is a product question

## Operating rules

- **Never "fix" flake with a retry, a sleep, or a widened selector.** All three hide
  the signal. Retries are a CI safety net, not a diagnosis.
- **Quarantine is temporary and visible**, never silent. A skipped test that nobody
  is tracking is worse than a red one.
- **Reproduce before theorising.** Flake attracts plausible stories.

## Procedure

### 1. Measure it

Get a rate before touching anything. A "flaky" test is often failing 1 in 50, and you
cannot tell whether a fix worked without a baseline.

```bash
npx playwright test <path> --repeat-each=20 --workers=1   # is it flaky alone?
npx playwright test <path> --repeat-each=20               # is it flaky in parallel?
```

The difference between those two runs is the single most diagnostic fact you can
collect. Passing serially and failing in parallel means shared state, not timing.

### 2. Classify the cause

| Cause                    | Signal                                                     | Fix                                                                               |
| ------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Shared mutable state** | Passes with `--workers=1`, fails in parallel               | Stop asserting on shared collections; assert the specific thing your test created |
| **Async race**           | Assertion fires before the effect lands                    | Web-first assertions; `network.waitForCall()` rather than `entries()`             |
| **Real time**            | Fails on a loaded machine, near midnight, or on a slow day | `page.clock` — never a sleep                                                      |
| **Order dependence**     | Fails only after another test                              | Each test creates and cleans its own state                                        |
| **Leaked state**         | First run passes, later runs fail                          | Reset between tests; check the app's in-memory store                              |
| **Environment**          | Fails only in CI                                           | Compare browser version, viewport, timezone, locale, machine speed                |

Both of the flakes this repo has actually had were in the first two rows: an assertion
on a shared collection's size, and reading `entries()` before Playwright delivered the
network event to Node. Check those first.

### 3. Fix the cause

Make the change, then re-run the same measurement from step 1. A fix that has not been
measured is a hope. If the rate was 1-in-20, twenty clean runs prove very little — run
enough to beat the original rate convincingly.

### 4. If you cannot fix it now

Quarantine explicitly and visibly: mark it, link the investigation, give it an owner
and a date. Record it in `.ai/state/PLAN.md`. A quarantined test with no owner becomes
permanent.

## Decision points

| Situation                          | Action                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Passes serially, fails in parallel | Shared state. Do not look at timing.                                                              |
| Fails only in CI                   | Compare environments before touching the test.                                                    |
| Cannot reproduce locally at all    | Raise CI retries temporarily to gather traces — then investigate, do not leave them raised.       |
| Whole suite is flaky               | Stop fixing tests. The environment or the app is the problem.                                     |
| Under pressure to just add a retry | Say what it costs: the suite stops being evidence, and the next real regression looks like flake. |

## Interlaying (blind spot)

This finds why a test is unstable. It does not tell you whether the test was worth
having — a flaky test that also asserts nothing should be deleted, not repaired
(`npm run assert-quality` will tell you). And intermittent _product_ bugs look exactly
like flake: before concluding "test problem", check whether the app is genuinely
non-deterministic under concurrency. Retrying a real race until it passes is how a
production defect gets shipped.

_Lineage and licences: `docs/sources.md`._
