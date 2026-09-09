import { defineConfig, devices } from '@playwright/test';
import { apps } from './apps/registry.js';

// External apps are opt-in: `npm run test:external`. They hit third-party sites,
// so they must never be able to redden a normal run or CI.
const includeExternal = process.env.RUN_EXTERNAL === '1';
const activeApps = apps.filter((app) => includeExternal || app.external !== true);
const localApps = apps.filter((app) => app.external !== true);

/** The app the harness' own self-tests run against. */
const harnessApp = apps.find((app) => app.name === 'todo-fixture');
if (harnessApp === undefined) throw new Error('todo-fixture app config is required');

export default defineConfig({
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['json', { outputFile: 'artifacts/results.json' }]]
    : [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'artifacts/results.json' }]],

  use: {
    // Traces and DOM snapshots pair with the network capture: together they are
    // what an agent needs to triage a failure it did not watch happen.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    // One project per app under test, derived from apps/registry.ts.
    ...activeApps.map((app) => ({
      name: app.name,
      testDir: `./apps/${app.name}/tests`,
      use: { ...devices['Desktop Chrome'], baseURL: app.baseURL },
    })),
    // Tests of the harness itself, not of any app.
    {
      name: 'harness',
      testDir: './tests/harness',
      use: { ...devices['Desktop Chrome'], baseURL: harnessApp.baseURL },
    },
  ],

  webServer: localApps
    .filter((app) => app.webServer !== undefined)
    .map((app) => ({
      command: app.webServer!.command,
      url: app.baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    })),
});
