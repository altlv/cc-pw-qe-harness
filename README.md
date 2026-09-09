# cc-pw-qe-harness

**cc** Claude · **pw** Playwright · **qe** quality engineering practices.

Playwright drives the browser, Claude reasons about what it finds, and the QE layer
decides whether any of it is trustworthy. The connective tissue is a network capture
layer: Playwright keeps request/response detail inside trace files, but an agent
triaging a failure it did not watch happen needs that evidence as text.

## Status

Honest state of each part of the name.

|        | Built                                                                                                                                                           | Not yet                                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **cc** | Bounded agent runner, triage agent, four role definitions (e2e-coder, api-coder, exploratory-tester, testability-reviewer)                                      | Agents not yet driven end to end; triage unverified against the live API; generation and self-healing not started |
| **pw** | Per-app projects, network capture fixture, API request fixture, BasePage, page scanner, clock-driven timing tests                                               | Auth/storageState setup, multi-browser, sharding, component tests                                                 |
| **qe** | Test quality gate, release-gate verdict (PASS/CONDITIONAL/FAIL), testability audit, practice docs for test design, risk, exploratory charters, defect reporting | Regression selection, flake tracking over time, quality metrics                                                   |

## Quick start

```bash
npm install
npx playwright install chromium
npm test
```

Runs against a bundled fixture app, so it works on a fresh clone with no external
environment and no API key.

## Apps under test

One folder per app under `apps/`, with its own config, tests, page objects and
scans. App folders share nothing, so adding a target cannot disturb another.

```
apps/todo-fixture/      bundled locally, starts automatically
apps/countdown-timer/   testpages.eviltester.com, external: true
```

Add one with `apps/<name>/app.config.ts` + `tests/`, then a line in
`apps/registry.ts`. Playwright derives everything else. See `apps/README.md`.

External apps are excluded from `npm test` and CI — a suite that goes red because
someone else's site is down teaches the team to ignore red. Run them explicitly:

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

### Test quality gate (`qe`)

`npm run assert-quality` — deterministic, no API key. Fails on tests with no
assertion, navigate-and-assert-once tests, unmarked fragile selectors, and banned
waits. Generated suites drift toward tests that are green and worthless; this is
the floor.

### Release gate (`qe`)

`npm run gate` aggregates results, flake and quality findings into a verdict:

- **FAIL** — failing tests, or tests that assert nothing. The suite is not telling
  the truth about the product.
- **CONDITIONAL** — flake, weak assertions, skipped tests. Shippable, recorded.
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

| Command                    | Does                                  |
| -------------------------- | ------------------------------------- |
| `npm test`                 | Local apps + harness self-tests       |
| `npm run test:external`    | Third-party apps, opt-in              |
| `npm run check`            | format + lint + typecheck             |
| `npm run assert-quality`   | Test quality gate                     |
| `npm run gate`             | Release verdict                       |
| `npm run scan -- <url>`    | Page scan + testability audit         |
| `npm run triage -- <file>` | Triage a failure JSON (needs API key) |

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
