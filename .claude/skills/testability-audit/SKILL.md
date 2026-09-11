---
name: testability-audit
description: Audit an app for how testable it is and raise findings a developer can act on — ambiguous or unaddressable controls, unlabelled inputs, state you cannot observe. Use when automation keeps breaking, before automating a new app, or when asked why tests are fragile. Not for writing tests (pwtest).
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

## Operating rules

- **A missing test id is not a finding.** Most applications do not have test ids and
  never will. A control with a clear accessible name is testable. Raising "add a test
  id" for every element produces a report nobody reads, and trains the team to ignore
  the next one — which may be real.
- **Raise what actually breaks a run**, in this order: a selector matching more than
  one element; a control reachable only by position; an input with no label; a control
  whose effect cannot be observed.
- **Prioritise honestly.** A problem on a primary action is worth raising; the same one
  on a footer link is noise.
- **Every finding carries the fix.** Name the exact attribute you would add.
- **Separate frontend from backend findings.** They go to different people.

## Procedure

### 1. Scan

```bash
npm run scan -- <url> apps/<app>/scans/<page>.json
SCAN_WITHIN=main npm run scan -- <url>    # scope out site chrome
```

The scanner reports each control's affordance (input / submit / toggle / control /
navigation), its input constraints, the attributes that expose its state, and whether
its suggested selector resolves to exactly one element. Commit the scan — it is a dated
testability record, and the delta between two scans is the evidence that things are
improving or rotting.

### 2. Read the addressability line, not the test-id count

- **ambiguous** — the selector matches several elements. This is the one that actually
  fails a run, via a strict-mode violation, and it fails regardless of test ids.
  Always raise it.
- **positional** — no name, no id, no test id. Nothing stable to target. Always raise.
- **by name** — reachable via role and accessible name. This is **fine**, and it is how
  most of the world's testable apps work. Worth mentioning only on a critical path in a
  product that localises.
- **stable** — a test id or a hand-written id. Nothing to do.

A page of entirely name-addressed controls is not a crisis. Say so, rather than filing
forty tickets.

### 3. Check what the scan cannot see

The scanner flags a **toggle that exposes no state** on its own. What it still cannot
tell you:

- **Does the observable state mean what it says?** `aria-expanded="true"` on a panel
  that never opened is worse than no attribute at all.
- **Is progress observable?** A spinner that never resolves and one that resolves
  invisibly look identical to a test.
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
[FE] Three "Edit" buttons share one accessible name — /bookings
  getByRole('button', { name: 'Edit' }) matches every row, so any test using it
  fails on a strict-mode violation rather than on the behaviour it checks.
  Fix: name them per row, e.g. aria-label="Edit booking 4821".

[FE] "Start Timer" gives no sign it started — /timer
  The button carries no aria-pressed and the app exposes no running state, so a
  test can click it and cannot assert that anything happened.
  Fix: add aria-pressed, or expose the state on the display element.

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

_Selector-stability grading is implemented in `src/tools/page-scanner.ts`; the ladder
it grades against is in `docs/conventions.md`. Lineage and licences: `docs/sources.md`._
