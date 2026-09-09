import { test as base, expect, type APIRequestContext } from '@playwright/test';

interface ApiFixtures {
  api: APIRequestContext;
}

/**
 * Entry point for `.api.spec.ts` files.
 *
 * Separate from the UI harness on purpose: the UI `test` attaches network capture
 * to a `page`, and importing it for an API-only spec would launch a browser to
 * watch traffic the test never generates.
 *
 * Auth belongs here. When the app needs a session, create the context with
 * `storageState` from the auth setup project rather than logging in per test.
 */
export const test = base.extend<ApiFixtures>({
  api: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({ baseURL });
    await use(context);
    await context.dispose();
  },
});

export { expect };
