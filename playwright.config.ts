import './src/env.js';
import { defineConfig, devices } from '@playwright/test';
import { apps } from './apps/registry.js';
import { defaultTarget, grepForPolicy, targetFor } from './apps/targets.js';
import { isEnvironment } from './src/qe/exploration-policy.js';

// External apps are opt-in: `npm run test:external`. They hit third-party sites,
// so they must never be able to redden a normal run or CI.
const includeExternal = process.env.RUN_EXTERNAL === '1';
const activeApps = apps.filter((app) => includeExternal || app.external !== true);

/**
 * TEST_ENV picks which deployment every app is pointed at, defaulting to each
 * app's own default. It also decides what may run there: on anything but local,
 * only tests that have declared a safe effect execute. An untagged test has an
 * unknown effect, and unknown is not the same as harmless.
 */
const requestedEnv = process.env.TEST_ENV;
if (requestedEnv !== undefined && !isEnvironment(requestedEnv)) {
  throw new Error(`TEST_ENV must be local, test or prod - got "${requestedEnv}"`);
}

const targetOf = (app: (typeof apps)[number]) =>
  (isEnvironment(requestedEnv) ? targetFor(app.name, requestedEnv) : undefined) ??
  defaultTarget(app);

const runnableApps = activeApps.filter(
  (app) => !isEnvironment(requestedEnv) || targetFor(app.name, requestedEnv) !== undefined,
);

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
    // Unit level: the harness's own pure logic. No browser, no server, no network.
    // Playwright Test is a general-purpose runner — it only starts a browser when a
    // test actually asks for `page`, so one runner covers all five levels and the
    // repo needs no second test framework.
    {
      name: 'unit',
      testDir: './tests/unit',
      testMatch: '**/*.test.ts',
    },
    // Integration level: the harness's modules wired together through their real
    // entry points — a spawned CLI, the actual filesystem, real exit codes. No
    // browser and no app under test.
    //
    // This is the layer that catches what unit tests structurally cannot: the CI
    // failure of 2026-09-09 was an unhandled ENOENT in a CLI's argument handling,
    // invisible to every pure-function test and to every browser test.
    {
      name: 'integration',
      testDir: './tests/integration',
      testMatch: '**/*.int.test.ts',
    },
    // One project per app under test, derived from apps/registry.ts. The baseURL
    // and the effect filter both come from the target, so pointing the suite at
    // another environment cannot forget to narrow what runs.
    ...runnableApps.map((app) => {
      const target = targetOf(app);
      const grep = grepForPolicy(target.policy);
      return {
        name: app.name,
        testDir: `./apps/${app.name}/tests`,
        use: { ...devices['Desktop Chrome'], baseURL: target.baseURL },
        ...(grep !== undefined ? { grep } : {}),
      };
    }),
    // Tests of the harness itself, not of any app.
    {
      name: 'harness',
      testDir: './tests/harness',
      use: { ...devices['Desktop Chrome'], baseURL: defaultTarget(harnessApp).baseURL },
    },
  ],

  // Only a local deployment is ever started by us; a webServer on any other
  // environment is refused by validateTargets().
  webServer: apps
    .map((app) => targetOf(app))
    .filter((target) => target.webServer !== undefined)
    .map((target) => ({
      command: target.webServer!.command,
      url: target.baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    })),
});
