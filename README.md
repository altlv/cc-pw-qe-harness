# cc-pw-qe-harness

Claude + Playwright test harness for QA/QE work.

Playwright drives the browser; Claude reasons about what it finds. The connective
tissue is a **network capture layer** — every test records its request/response
traffic, which is what makes AI-assisted triage possible at all. Playwright keeps
that detail inside a trace file; this harness hands it to an agent as text.

## Status

Early. One capability is built end to end; the rest are intentionally not scaffolded.

| Capability                                                   | Status     |
| ------------------------------------------------------------ | ---------- |
| **Failure triage** — classify a red test from its evidence   | ✅ built   |
| **Test generation** — Playwright specs from specs/live pages | ⬜ planned |
| **Exploratory agent** — Claude drives the browser unscripted | ⬜ planned |
| **Self-healing selectors** — repair locators on failure      | ⬜ planned |

The generation workflow will port from the `pwtest` skill in `goose-harness`, which
already has the hard parts worked out: scan the page, record the flow, design
scenarios, get explicit approval, generate, run, debug with an attempt cap.

## Quick start

```bash
npm install
npx playwright install chromium
npm test
```

That runs against a bundled fixture app (`fixtures-app/`), so it works with no
external environment and no API key.

For the agent side, copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`:

```bash
npm run triage -- examples/failure-403.json
```

## How it fits together

```
Playwright test
   │
   ├─ NetworkRecorder      every request/response, auto-attached on failure
   ├─ quality gate         fails tests that assert nothing
   │
   └─ on failure ─────────► triage agent ──► {classification, evidence, fix}
                             (bounded by turns / spend / wall-clock)
```

### Network capture

On by default. Assert on it directly, which catches the failure a UI-only test
sleeps through:

```ts
import { test, expect } from '../../src/fixtures/harness.js';

test('should persist the todo when a title is given', async ({ page, network }) => {
  await page.getByTestId('todo-input').fill('Ship the harness');
  await page.getByTestId('todo-submit').click();

  await expect(page.getByTestId('todo-item').last()).toBeVisible();

  const create = await network.waitForCall((c) => c.method === 'POST' && c.path === '/api/todos');
  expect(create?.status).toBe(201);
});
```

A DOM-only assertion here passes even when the write 500s and the list renders from
stale client state.

### Bounded agents

Every agent run is capped on turns, dollars, and wall-clock — whichever trips first
ends the run and returns a partial result that says why. An agent that cannot find
the answer does not error; it keeps looking. Limits live in `.env`:

```
AGENT_MAX_TURNS=12
AGENT_MAX_USD=1.00
AGENT_TIMEOUT_MS=180000
```

### Quality gate

`npm run assert-quality` is a deterministic check, no API key required, that fails on:

- tests with no `expect()` at all
- navigate-and-assert-once tests with no interaction
- unmarked position/class-dependent CSS selectors
- `waitForTimeout()`

It runs in CI ahead of the browser tests, and exists because generated suites drift
toward tests that are green and worthless.

## Commands

| Command                    | Does                                  |
| -------------------------- | ------------------------------------- |
| `npm test`                 | Playwright suite                      |
| `npm run check`            | format + lint + typecheck             |
| `npm run assert-quality`   | test quality gate                     |
| `npm run triage -- <file>` | triage a failure JSON (needs API key) |

## CI

GitHub Actions on push and PR. The `verify` job (format, lint, typecheck, quality
gate, Playwright) needs no secrets. Agent checks are a separate job so a fork PR
without `ANTHROPIC_API_KEY` skips them rather than failing.

## Conventions

`docs/conventions.md` for test rules, `CLAUDE.md` for how agents should work here.

## Stack

TypeScript (ESM/NodeNext) · `@playwright/test` · `@anthropic-ai/claude-agent-sdk` ·
zod · ESLint + Prettier · Node 20+
