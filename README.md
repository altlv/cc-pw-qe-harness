# cc-pw-qe-harness

**cc** Claude · **pw** Playwright · **qe** quality engineering practices.

Playwright drives the browser, Claude reasons about what it finds, and the QE layer
decides whether any of it is trustworthy. The connective tissue is a network capture
layer: Playwright keeps request/response detail inside trace files, but an agent
triaging a failure it did not watch happen needs that evidence as text.

## Status

Honest state of each part of the name.

|        | Built                                                                                                                                                                                                                           | Not yet                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **cc** | Bounded agent runner with a working stop path · a role per test level plus `investigator` · loadable skills · **roles validated end to end against live targets, their claims checked against ground truth**                    | Most roles still unexecuted · no skill invoked by name · no orchestration recipes |
| **pw** | Five test levels on one runner — unit, integration, api, e2e, exploratory · network capture fixture · page scanner · **self-healing locators, with every heal recorded and gated** · clock-driven timing · per-subject projects | Auth/storageState setup · multi-browser · sharding · component tests              |
| **qe** | Test quality gate · release-gate verdict PASS/CONDITIONAL/FAIL with staleness detection · checkable report format · mutation testing                                                                                            | Regression selection · flake tracking over time · quality metrics · tier-3 evals  |

Two words worth pinning down. **Validated** means the role ran, stayed inside its
budget, produced a report that passes `npm run check-report`, and every number it
reported was checked against an independent source — not that it looked plausible.
**Unexecuted** means exactly that: a role is prose until someone runs it, and most of
them still are. `.ai/state/PLAN.md` names which.

Counts are deliberately absent from this file. Inventory numbers rot the moment code
changes, and a confidently wrong number is worse than none — `npm run mutate`,
`npm test` and `ls .claude/skills` report the current ones.

## Quick start

```bash
npm install
npx playwright install chromium
npm test
```

Runs against a bundled fixture app, so it works on a fresh clone with no external
environment and no API key.

## Apps — the subjects under test

**`apps/` holds the things being tested, not the harness.** Each folder is a subject
under test plus the tests written against it. None of it is harness code, nothing in
`src/` imports from `apps/`, and deleting an app folder removes a target without
touching the tool.

The harness lives in `src/`. Its own tests live in `tests/`.

| App               | Kind           | What it is for                                                                                                       |
| ----------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `todo-fixture`    | local, bundled | Gives the suite and the network capture something real to exercise offline. Starts automatically.                    |
| `countdown-timer` | external       | Time-based UI. Proves the no-arbitrary-waits rule — a 30-second countdown asserted in milliseconds via `page.clock`. |
| `fakerestapi`     | external       | Validation target for the `api-coder` role. Has three real contract defects to write tests against.                  |

Each app folder carries its own `app.config.ts`, `tests/`, and — where they exist —
`pages/`, `scans/`, `coverage.md` and a `README.md` recording what was learned about
it. App folders share nothing, so adding a subject cannot disturb another.

Add one with `apps/<name>/app.config.ts` + `tests/`, then a line in
`apps/registry.ts`. Playwright derives the project, base URL and web server from the
registry. See `apps/README.md`.

**External subjects are excluded from `npm test` and CI** — a suite that goes red
because someone else's site is down teaches the team to ignore red. Run them
explicitly:

```bash
npm run test:external
```

## What each layer does

### Network capture (`pw`)

On by default; attaches to the HTML report on failure. Assert on it directly:

```ts
const create = await network.waitForCall((c) => c.method === 'POST' && c.path === '/api/todos');
expect(create?.status).toBe(201);
```

A DOM-only assertion passes even when the write 500s and the list renders from
stale client state. `tests/harness/network-capture.ui.spec.ts` proves exactly that,
rather than asking you to take it on trust.

### No arbitrary waits (`pw`)

`waitForTimeout` and `waitForSelector` are lint errors. For time-dependent UI drive
`page.clock` instead — the countdown-timer suite asserts a 30-second countdown and
a 60-second hold, and the whole file runs in about three seconds.

### Page scanner and testability audit (`qe`)

```bash
npm run scan -- https://example.com/app
```

Inventories interactive elements, grades every selector `stable` /
`text-dependent` / `fragile`, and reports what the team should fix to make the app
testable. This is the prerequisite for generating tests: without it an agent invents
selectors, which is how generated suites fill up with `.btn:nth-child(3)`.

### Self-healing locators (`pw`)

A selector rots when the page it names changes — an id regenerated by a rebuild, a
label reworded, a control moved. `src/tools/identity.ts` scores whether two
observations are the same control; `src/tools/heal.ts` uses that to find it again.

```ts
import { test, expect } from '../../src/fixtures/harness.js';

test('adds a todo', async ({ page, healing }) => {
  await page.goto('/');
  const submit = await healing.locator('[data-testid="todo-submit"]');
  await submit.click();
});
```

Capture baselines deliberately — `CAPTURE_BASELINES=1 npm test` — into a committed
`apps/<app>/baselines.json`. They are part of the tests: a heal is only reviewable
if what it healed _from_ shows up in the diff.

Three rules make this safe rather than dangerous:

- **A working selector is never second-guessed.** If it still resolves to exactly
  one element, that element wins. Healing is a fallback, not a policy.
- **A heal that is not decisive is refused.** Three identical `Edit` buttons give
  no answer, so the test fails with the rivals listed rather than picking one.
- **A healed run is not a clean run.** Every heal reaches `npm run gate` as a
  recorded risk, naming the selector the test should be changed to say. A heal is
  a proposal; nothing here rewrites a test file.

### Test quality gate (`qe`)

`npm run assert-quality` — deterministic, no API key. Fails on tests with no
assertion, navigate-and-assert-once tests, unmarked fragile selectors, and banned
waits. Generated suites drift toward tests that are green and worthless; this is
the floor.

### Release gate (`qe`)

`npm run gate` aggregates results, flake and quality findings into a verdict:

- **FAIL** — failing tests, or tests that assert nothing. The suite is not telling
  the truth about the product.
- **CONDITIONAL** — flake, weak assertions, skipped tests, healed locators.
  Shippable, recorded.
- **PASS** — clean.

Three outcomes rather than two, so a known risk can be shipped _and_ written down.

### Bounded agents (`cc`)

Every run is capped on turns, dollars and wall-clock; whichever trips first ends
the run and returns a partial result saying why. An agent that cannot find the
answer does not error — it keeps looking.

```
AGENT_MAX_TURNS=12
AGENT_MAX_USD=1.00
AGENT_TIMEOUT_MS=180000
```

Roles live in `src/agents/roles.ts` as SDK `AgentDefinition`s, each carrying the
guardrails and the repo conventions in its prompt.

## Commands

| Command                           | Does                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm test`                        | Local subjects + harness self-tests (unit, integration, api, e2e)                                      |
| `npm run test:external`           | Third-party subjects, opt-in                                                                           |
| `npm run check`                   | format + lint + typecheck                                                                              |
| `npm run assert-quality`          | Test quality gate                                                                                      |
| `npm run gate`                    | Release verdict, refusing stale results                                                                |
| `npm run mutate`                  | Breaks each enforced rule deliberately and checks the suite notices                                    |
| `npm run scan -- <url>`           | Page scan + testability audit (`SCAN_DEEP=1` also probes hover, keyboard, responsive, scroll and zoom) |
| `npm run crawl -- <url>`          | Crawl the site: link graph, broken links, orphans, template clusters                                   |
| `npm run targets`                 | Every app and the environments it can be pointed at                                                    |
| `npm run check-report -- <path>`  | Validate a QA report against `docs/report-format.md`                                                   |
| `npm run role -- <role> "<task>"` | Run an agent role (needs a key)                                                                        |
| `npm run triage -- <file>`        | Triage a failure JSON (needs a key)                                                                    |

Anything needing a key reads it from `.env` — see `.env.example`. `.env` is gitignored;
never commit one.

## Practices

`.claude/skills/` — loadable skills for deciding what to test (`risk-assessment`,
`test-design`, `exploratory-session`), judging findings (`oracle-check`, `bug-report`,
`flaky-test-detection`), writing tests (`pwtest`, `testability-audit`) and working
honestly (`work-discipline`, `honesty-check`). See
[`.claude/skills/README.md`](.claude/skills/README.md) for routing and for what is
deliberately absent.

`docs/conventions.md` for code rules, `CLAUDE.md` for how agents work here.

Much of this is adapted from a Goose-based QA harness: the guardrails, the verdict
schema, the selector ladder and the anti-pattern list.

## CI

GitHub Actions on push and PR. `verify` needs no secrets: format, lint, typecheck,
quality gate, Playwright, release gate. Agent checks are a separate job so a fork
PR without `ANTHROPIC_API_KEY` skips rather than fails.

## Stack

TypeScript (ESM/NodeNext) · `@playwright/test` · `@anthropic-ai/claude-agent-sdk` ·
zod · faker · ESLint + Prettier · Node 20+
