---
name: testability-audit
description: Audit an app for how testable it is and raise findings a developer can act on — missing test ids, text-dependent selectors, unobservable state. Use when automation keeps breaking, before automating a new app, or when asked why tests are fragile. Not for writing tests (pwtest).
---

Fragile tests are usually a product problem wearing a test costume. If the only way to
reach a control is its position or its wording, every suite built on it will rot — and
rewriting the tests will not fix it.

## When to use

- Before automating an app for the first time
- Tests in an area keep breaking on unrelated changes
- Someone asks why automation is so expensive to maintain
- A scan reports fragile selectors and you need to turn that into action

## When NOT to use

- You are writing tests now → `pwtest` (it produces findings as a side effect)
- The app is yours to change → just add the test ids

## Operating rules

- **Prioritise honestly.** A missing test id on a primary action is worth raising; one
  on a footer link is noise, and a report full of noise gets ignored entirely.
- **Every finding carries the fix.** Name the exact attribute you would add.
- **Separate frontend from backend findings.** They go to different people.

## Procedure

### 1. Scan

```bash
npm run scan -- <url> apps/<app>/scans/<page>.json
SCAN_WITHIN=main npm run scan -- <url>    # scope out site chrome
```

The scanner grades every interactive element **stable** / **text-dependent** /
**fragile** and writes findings. Commit the scan — it is a dated testability record,
and the delta between two scans is the evidence that things are improving or rotting.

### 2. Read the grades, not just the count

- **stable** — a test id, or a hand-written id. Nothing to do.
- **text-dependent** — reachable only by its visible text. Works today; breaks on a
  copy change or a second locale. Worth raising for anything on a critical path.
- **fragile** — no test id, no id, no accessible name. There is nothing stable to
  target at all. Always worth raising.

A page of entirely text-dependent controls is not a crisis if the product ships in one
language and the copy is stable. Say that, rather than filing forty tickets.

### 3. Check what the scan cannot see

The scanner reads the DOM. It cannot tell you:

- **Is state observable?** Can a test tell success from failure without screenshots?
  A spinner that never resolves and a spinner that resolves invisibly look identical.
- **Is there an API to assert against?** UI-only truth forces every check through the
  slowest layer.
- **Can the app be put into a state?** If reaching the case under test needs twenty
  manual steps, it will not be tested.
- **Is anything time-dependent unmockable?** If the app reads real time in a way
  `page.clock` cannot intercept, timing behaviour is untestable.

These are usually the more expensive findings, and they are invisible to a scan.

### 4. Write it up

Group by page area, lead with what blocks coverage of the highest-risk features. Per
finding: the element, why it makes automation unreliable, and the concrete fix.

```
[FE] Primary "Add booking" button has no data-testid — /bookings
  Reachable only by its label, so the test breaks on any copy or locale change.
  Fix: add data-testid="booking-submit".

[BE] No endpoint exposes booking state — /bookings
  Tests must infer success from rendered rows, so a stale render passes.
  Fix: expose GET /api/bookings/{id} returning status.
```

Follow `bug-report` conventions for anything you file.

## Decision points

| Situation                                                | Action                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Scan returns 80 findings                                 | You scanned site chrome. Re-run with `SCAN_WITHIN`.                                                            |
| Everything is text-dependent, single locale, stable copy | Say it is acceptable and name the condition under which it stops being acceptable.                             |
| App is third-party                                       | You cannot get fixes. Record the constraint in `apps/<app>/README.md` so the next person does not re-audit it. |
| Fragile element on a low-risk path                       | Note it, do not file it. Signal-to-noise is what keeps the next report readable.                               |

## Interlaying (blind spot)

A scan measures what is reachable, not what matters — it cannot tell a primary action
from a footer link, so the prioritisation is entirely yours. It also says nothing about
whether the app's _behaviour_ is testable, only its _surface_. And it is a snapshot:
testability rots between releases, which is the argument for committing scans and
diffing them.

_Recreated for this harness. Selector-stability grading is implemented in
`src/tools/page-scanner.ts`; the ladder it grades against is in `docs/conventions.md`._
