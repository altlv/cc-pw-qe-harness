# HANDOFF — restart packet

## What we are doing
Making cc-pw-qe-harness showable. Repo is public but empty; 2 local commits exist.
User owns the launch (squash + push); local commits are fine without asking.

## What changed
Per-app structure under `apps/`, network capture, page scanner, quality gate,
release-gate verdict, API fixture, BasePage, agent role definitions, QE practice docs.

## What is proven
Local 10 tests, external 6 tests, full check clean, gate PASS/FAIL both demonstrated,
quality gate demonstrated in both directions, capture proof test.

## What is NOT proven
`roles.ts` never executed. Triage never hit the live API (no key). CI never ran.
Zero unit tests for the 17 files under src/.

## What must not be assumed
- Do not claim the `cc` third is covered — it rests on unexecuted code.
- Do not push. Do not create the launch commit.
- Do not assert on shared collection sizes in tests; parallel workers share app state.

## Next action
Tier 0 item 2: unit tests for src/ pure logic.
