# CLAUDE.md

Conventions for this repo. Read `docs/conventions.md` before writing or changing a test.

## What this repo is

A harness that pairs Claude (via `@anthropic-ai/claude-agent-sdk`) with Playwright for
QA/QE work. Four capabilities, in build order:

| Capability        | Status  | Entry point            |
| ----------------- | ------- | ---------------------- |
| Failure triage    | built   | `src/agents/triage.ts` |
| Test generation   | planned | —                      |
| Exploratory agent | planned | —                      |
| Self-healing      | planned | —                      |

Only triage is implemented. The others are deliberately absent rather than stubbed —
do not add placeholder modules for them. Build one end-to-end when it is wanted.

## Non-negotiables

**1. Every agent runs under a budget.** Never call `query()` from the SDK directly.
Go through `runAgent()` in `src/agents/client.ts`, which enforces turn, spend, and
wall-clock limits from `Budget`. An agent that cannot solve a problem will keep
trying, and the failure mode is a long expensive loop, not an error. If you add an
agent, give it the tightest `maxTurns` that can work.

**2. A test must prove behaviour, not coverage.** Assert on an observable outcome.
For state changes assert on the UI _and_ the captured network call. `npm run
assert-quality` is the mechanical floor and it gates CI.

**3. Evidence over inference.** Agents reason from captured artifacts — network
entries, error text, DOM snapshots — never from assumptions about how the app works.
The triage system prompt says to prefer "unknown" over a confident guess; keep that
property in anything new.

**4. Never widen a selector or delete an assertion to make a test green.** That is
the one shortcut that destroys the value of the suite. Fix the locator or report
the bug.

**5. Do not read or commit `.env`.** `ANTHROPIC_API_KEY` lives there. Agent code
reads it from the environment; nothing should print it.

## Layout

```
src/agents/     Claude-side: budget guard, SDK client, triage
src/capture/    Network recorder — the evidence layer
src/fixtures/   Playwright fixtures; import test/expect from here
src/quality/    Static analysis that gates generated tests
src/cli/        Runnable entry points
tests/          Specs
fixtures-app/   Tiny app under test, so CI needs no external environment
```

## Commands

```bash
npm test                  # Playwright
npm run check             # format + lint + typecheck
npm run assert-quality    # test quality gate
npm run triage -- <file>  # triage a failure JSON (needs API key)
```

## Network capture

Capture is on by default via the `network` fixture (`auto: true`) and attaches to the
HTML report when a test fails. Playwright's own reporting keeps this in the trace but
never hands it over as text — which is exactly what an agent needs, since a 403 on a
background call explains a "button does nothing" failure that the DOM cannot.

Assert with `await network.waitForCall(predicate)`, not `entries()`. Network events
reach Node asynchronously, so the DOM can already show a request's result before the
recorder has seen it. This caused a real 1-in-60 flake during initial development.

## Gotchas

- Relative imports need `.js` extensions (NodeNext).
- `fixtures-app/server.mjs` is plain JavaScript, not TypeScript.
- The fixture app holds todos in memory and grows across a run; write tests that do
  not assume a fixed initial count.
