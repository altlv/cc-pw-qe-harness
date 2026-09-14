import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FAULT_ANNOTATION, FAULT_BODY, FAULT_STATUS, faultRequested } from '../qe/fault.js';

interface ApiOptions {
  /**
   * Whether the request context talks to a server that answers every call with a 500.
   * Off in every ordinary run; `npm run fault-check` turns it on. See `src/qe/fault.ts`.
   */
  harnessFault: boolean;
}

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
export const test = base.extend<ApiOptions & ApiFixtures>({
  harnessFault: [faultRequested(), { option: true }],

  api: async ({ playwright, baseURL, harnessFault }, use, testInfo) => {
    if (!harnessFault) {
      const context = await playwright.request.newContext({ baseURL });
      await use(context);
      await context.dispose();
      return;
    }

    // Under the fault the context's base URL is a local server that fails every call.
    // A spec that builds absolute URLs bypasses it and is reported as untouched, not
    // as caught — which is the honest reading of a spec the fault never reached.
    let corrupted = 0;
    const server = createServer((_request, response) => {
      corrupted += 1;
      response.writeHead(FAULT_STATUS, { 'content-type': 'application/json' });
      response.end(FAULT_BODY);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    const context = await playwright.request.newContext({ baseURL: `http://127.0.0.1:${port}` });
    await use(context);
    await context.dispose();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    testInfo.annotations.push({ type: FAULT_ANNOTATION, description: String(corrupted) });
  },
});

export { expect };
