---
name: pwtest
description: Generate Playwright UI or API tests for an app in this harness. Walks through scanning the page, designing scenarios, getting them approved, generating code, running it, and debugging. Use when asked to write, generate, or add Playwright tests for an app under apps/.
---

Generate Playwright tests for an app in `apps/`. Follow the steps in order. The user
may not be a developer — keep language plain and ask one question at a time.

Adapted from a workflow originally written for a single commercial product. The
product-specific parts (team folders, ticket project, bespoke auth) are gone; the
discipline is what carried over.

## Non-negotiables

- **Scan before you generate.** Never invent a selector. Run the scanner and use what
  it reports.
- **Design before you code**, and get the scenario list approved. Do not write a spec
  until the user says yes.
- **A test must prove behaviour.** No assertion, or navigate-and-assert-once, is a
  build failure (`npm run assert-quality`).
- **Three attempts.** On a failing test, make at most 3 materially different fix
  attempts, then stop and report with evidence.
- **Infrastructure failures are not product failures.** Auth, environment down, DNS —
  report them, do not edit tests to route around them.
- Never read `.env`. Never delete auth state. Never widen a selector to force a pass.

## Step 1 — Pick the app

```
apps/*/app.config.ts
```

Ask which app if more than one. If the app does not exist yet, create
`apps/<name>/` with `app.config.ts` and `tests/`, register it in `apps/registry.ts`,
and write `apps/<name>/README.md`. See `apps/README.md` for the contract.

## Step 2 — UI or API

Use AskUserQuestion: **UI** (browser flow) or **API** (endpoint behaviour).

- UI → `apps/<app>/tests/<feature>.ui.spec.ts`, import from `src/fixtures/harness.js`
- API → `apps/<app>/tests/<feature>.api.spec.ts`, import from `src/fixtures/api.js`

Read the matching pattern file before writing anything:
`patterns/ui-test.md`, `patterns/api-test.md`, `patterns/smoke-test.md`,
`patterns/page-object.md`.

## Step 3 — Scan the target

```bash
npm run scan -- <url> apps/<app>/scans/<feature>.json
```

Set `SCAN_WITHIN` to a CSS scope when the page has heavy site chrome, or the report
drowns in nav links.

Report back briefly: how many interactive elements, how many have `data-testid`, and
the stable / text-dependent / fragile split. Commit the scan — it is a testability
record, and it is the evidence the next step rests on.

If the scan reports fragile elements, note them. They become testability findings in
Step 7.

## Step 4 — Learn the behaviour, do not assume it

Before designing, verify how the feature actually behaves. Probe it — a short
throwaway spec that prints values is fine, and delete it afterwards.

This step exists because assumptions are wrong often enough to matter. In this repo a
timer's `reset` was assumed to pause the countdown; it does not, and the assumption
would have produced a test that failed against correct behaviour.

## Step 5 — Design scenarios and get approval

Apply `.claude/skills/test-design/SKILL.md`: equivalence partitioning, boundary values,
decision tables, and state transition for anything with modes. Score risk with
`.claude/skills/risk-assessment/SKILL.md` to decide depth.

Present the plan:

```markdown
## <Feature>

Preconditions: <state needed>

1. <name> — Action: <what> · Expected: <what> · Assertions: <specific checks>
2. ...

Not covered: <what you are deliberately leaving out, and why>
```

The "not covered" line is required. Then ask: **Approve / Change / Add / Back**.
**Do not generate code until the user approves.**

## Step 6 — Generate, run, debug

Write the smallest useful test. Reuse the app's page object if one exists; create one
under `apps/<app>/pages/` if the flow warrants it (`patterns/page-object.md`).

Follow `docs/conventions.md`: selector ladder, `.js` import extensions,
Arrange-Act-Assert, `test.step()` for long flows. For state changes assert the UI
**and** the captured network call. For anything time-dependent use `page.clock`, never
a sleep.

```bash
npx playwright test <path> --project=<app> --reporter=line
```

On failure, classify before fixing: selector, assertion, timing, or a genuine product
bug. Fix the first three; **report the fourth** rather than adapting the test to it.
Stop after 3 different attempts.

## Step 7 — Verify the tests are worth having

```bash
npm run assert-quality
npm run check
```

Then report:

- files created or changed
- exact commands run and their results — and any check **NOT RUN**, stated explicitly
- testability findings from the scan, written per `.claude/skills/bug-report/SKILL.md`
- what remains untested from the Step 5 plan

Update `.ai/state/STATUS.md` if the task spanned more than one sitting.

## Step 8 — Offer the pair

UI tests done → offer API tests for the same feature, and vice versa. They catch
different defects: the UI can look right over a failed write, and a passing endpoint
says nothing about whether the user can reach it.
