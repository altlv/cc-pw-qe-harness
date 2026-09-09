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
