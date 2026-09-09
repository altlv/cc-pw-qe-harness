import { test as base, expect } from '@playwright/test';
import { NetworkRecorder } from '../capture/network.js';

interface HarnessFixtures {
  network: NetworkRecorder;
}

/**
 * Use this instead of `@playwright/test` directly.
 *
 * Network capture is auto-enabled: every test records its traffic whether or not
 * it asks for it, and a failing test attaches the capture to the HTML report. The
 * point is that the evidence exists at the moment of failure — you cannot go back
 * and re-record the run that broke in CI last night.
 */
export const test = base.extend<HarnessFixtures>({
  network: [
    async ({ page }, use, testInfo) => {
      const recorder = NetworkRecorder.attach(page);

      await use(recorder);

      if (testInfo.status !== testInfo.expectedStatus) {
        await recorder.settle();
        await testInfo.attach('network-capture.json', {
          body: JSON.stringify(recorder.entries(), null, 2),
          contentType: 'application/json',
        });
        await testInfo.attach('network-summary.json', {
          body: JSON.stringify(recorder.summarize(), null, 2),
          contentType: 'application/json',
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
