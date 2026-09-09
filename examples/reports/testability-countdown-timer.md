---
report: testability
target: apps/countdown-timer
date: 2026-09-09
author: testability-reviewer
verdict: CONDITIONAL
confidence: medium
evidence:
  direct: 2
  inferred: 1
  claimed: 0
findings:
  - id: T1
    severity: major
    evidence: direct
    summary: No data-testid anywhere on the timer app; every control falls to an id selector.
    where: https://testpages.eviltester.com/apps/countdown-timer/
    basis: Selector ladder in docs/conventions.md — test ids are the only tier that survives copy changes.
  - id: T2
    severity: minor
    evidence: direct
    summary: Six navigation links are reachable only by their visible text.
    where: scan apps/countdown-timer/scans/timer.json
    basis: Text-dependent selectors break on any copy or locale change.
  - id: T3
    severity: question
    evidence: inferred
    summary: Timer state is readable only from the rendered display, with no API to assert against.
    where: apps/countdown-timer
    basis: The DOM is the single source of truth, so a stale render is indistinguishable from correct state.
not_covered:
  - Mobile viewports — scanned desktop Chrome only.
  - Screen-reader behaviour — no assistive technology was used.
not_run:
  - Automated accessibility scan — no axe integration in this harness yet.
---

## Summary

The countdown timer is testable but only through hand-written ids. That is workable
today and fragile the moment the markup is regenerated. It is a third-party practice
site, so none of these findings can actually be fixed — they are recorded to explain
why this app's specs use `locator('#id')` rather than `getByTestId`.

## Findings

### T1 — No test ids

The scan reports 11 interactive elements in `main`, 0 with `data-testid`, 5 stable
(hand-written ids), 6 text-dependent. The ids are stable in practice because the page
is hand-authored, which is why the scanner grades them stable rather than fragile.

### T2 — Text-dependent navigation

Not worth acting on: the site ships in one language and the copy is stable.

### T3 — No state API

Inferred, not observed: the app is client-side only and makes no network calls at all,
so there is nothing to assert against besides the display.

## Not covered

Desktop Chrome only, no assistive technology, no mobile emulation.

## Next

None actionable — third-party app. Recorded in `apps/countdown-timer/README.md` so the
next person does not re-audit it.
