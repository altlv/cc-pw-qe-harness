# Test conventions

Rules that apply to every test in this repo, whether a person or an agent wrote it.
Adapted from the `pwtest` conventions in `goose-harness`, with the product-specific
parts (team folders, Jira project, auth scheme) stripped out.

## Selector priority

Use the first one that works, in this order:

1. **`getByTestId`** — stable, language-independent. No warning.
2. **`getByRole` with a name** — semantic and accessible, but breaks if UI copy or
   language changes. Mark it: `// TODO (Text-dependent): prefer data-testid.`
3. **`getByLabel` / `getByPlaceholder` / `getByText`** — same caveat as above.
4. **CSS selectors** — last resort, and only when marked:
   ```ts
   // TODO (Fragile): needs a stable data-testid
   page.locator('.actions-panel button:nth-child(3)');
   ```

The quality gate fails the build on a class- or position-dependent CSS selector that
carries no `TODO (Fragile)` marker.

## Banned

Enforced by ESLint, so these fail lint rather than review:

- `page.waitForTimeout(n)` — use web-first assertions or `locator.waitFor()`
- `page.waitForSelector()` — locators already auto-wait
- `test.only()` in committed code

Also avoid, though not machine-checkable: hardcoded environment-specific IDs,
assertions inside Page Objects, and shared mutable state between independent tests.

## A test must prove behaviour

This is the rule the harness cares about most, because it is the one generated tests
break. A test that navigates and asserts nothing passes forever and catches nothing.

Every test needs at least one assertion tied to an observable outcome, and for a flow
that changes state, assert on **both** layers:

```ts
// UI outcome
await expect(page.getByTestId('todo-item').filter({ hasText: title })).toBeVisible();

// Network outcome — catches a silent 500 behind an optimistic UI update
const create = await network.waitForCall((c) => c.method === 'POST' && c.path === '/api/todos');
expect(create?.status).toBe(201);
```

`npm run assert-quality` enforces the floor: no assertion, or navigate-plus-one-weak-
assertion with no interaction, is a build failure.

## Naming and structure

- Test title: `should [expected behaviour] when [condition]`
- Files: `{feature}.ui.spec.ts` for browser flows, `{feature}.api.spec.ts` for API-only
- Arrange–Act–Assert inside every test; `test.step()` for long flows
- Relative imports carry the `.js` extension (NodeNext ESM resolution)
- Import `test`/`expect` from `src/fixtures/harness.js`, never from `@playwright/test`
  directly — the harness fixture is what enables network capture

## Network assertions

`network.entries()` is a snapshot and can lag the DOM, because Playwright delivers
network events to Node asynchronously. Right after an action, use
`await network.waitForCall(predicate)`, which polls. Use `entries()` only for
after-the-fact inspection, and `settle()` when you need everything in flight to land.

## Do not put inventory counts in documentation

Numbers that describe _how many things exist_ rot the moment the code changes, and a
confidently wrong number is worse than none — a reader who spots one stale figure stops
trusting the rest of the page.

Real cases from this repo: the README claimed "four role definitions" when there were
seven, and "17 mutations" while a naive `grep` said 18 — which sent someone hunting a
bug that did not exist.

**Instead of a count, name the command that produces it.**

| Avoid                          | Prefer                                                  |
| ------------------------------ | ------------------------------------------------------- |
| "ten loadable skills"          | "loadable skills — `ls .claude/skills`"                 |
| "mutation testing at 17/17"    | "mutation testing — `npm run mutate` reports the score" |
| "the quality gate has 5 rules" | "the quality gate — `npm run assert-quality`"           |
| "123 tests pass"               | "the suite passes — `npm test`"                         |

**Numbers used as principles are fine**, because they do not describe inventory and so
cannot go stale:

- "One violation is an opinion; three is a pattern."
- "One object per page, not per test."
- "Stop after three materially different attempts."
- Step numbers in a procedure.

The test is simple: _would this number change if someone added a file?_ If yes, do not
write it down — point at the thing that counts.

State files under `.ai/state/` are the deliberate exception. They are a dated snapshot
of a moment, refreshed at the end gate, and a count there is evidence rather than
documentation — but it still carries the date it was taken.
