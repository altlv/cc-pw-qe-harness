import { test as base, expect, type Locator } from '@playwright/test';
import { NetworkRecorder } from '../capture/network.js';
import { baselineKey, loadBaselines, saveBaselines, writeHealRecords } from '../qe/baselines.js';
import {
  captureBaseline,
  formatHeals,
  HealJournal,
  resolveLocator,
  type Baseline,
  type HealRecord,
} from '../tools/heal.js';

/**
 * Locators that survive the page changing under them — when, and only when, the
 * evidence can vouch for the change.
 */
export interface Healing {
  /**
   * The locator for `selector`, healed against its baseline if it no longer
   * resolves.
   *
   * Throws when it cannot be resolved, carrying the evidence in the message. That
   * is the point: the alternative to a loud failure here is a test that quietly
   * proceeds against whichever element happened to score highest.
   */
  locator(selector: string): Promise<Locator>;
  /** What happened to every locator this test asked for. */
  records(): readonly HealRecord[];
}

interface HarnessOptions {
  /**
   * Where this project's baselines live. Defaults to `apps/<project>/baselines.json`.
   *
   * A committed file, not an artefact: a baseline is part of the test, and a heal
   * proposal is only reviewable when what it healed *from* shows up in the diff.
   */
  baselineFile: string | undefined;
  /**
   * Where this run's heal records are journalled. Defaults to `artifacts/heals`,
   * which is what the gate reads.
   *
   * Overridable so the harness's own tests of the healer can journal somewhere
   * else: a deliberate heal in a self-test is not a heal in the product's suite,
   * and letting it reach the gate would make the harness report debt it does not
   * have.
   */
  healJournalDir: string;
  /**
   * Whether a selector with no baseline should get one.
   *
   * Off by default, and off in CI, because a run that quietly recaptured would
   * leave every baseline exactly as old as the page it was checked against — and
   * a baseline that is never older than what it checks can never notice anything
   * changing. Turn it on deliberately: `CAPTURE_BASELINES=1 npm test`.
   */
  captureBaselines: boolean;
}

interface HarnessFixtures {
  network: NetworkRecorder;
  healing: Healing;
}

/**
 * Use this instead of `@playwright/test` directly.
 *
 * Network capture is auto-enabled: every test records its traffic whether or not
 * it asks for it, and a failing test attaches the capture to the HTML report. The
 * point is that the evidence exists at the moment of failure — you cannot go back
 * and re-record the run that broke in CI last night.
 */
export const test = base.extend<HarnessOptions & HarnessFixtures>({
  baselineFile: [undefined, { option: true }],
  healJournalDir: ['artifacts/heals', { option: true }],
  captureBaselines: [process.env.CAPTURE_BASELINES === '1', { option: true }],

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

  healing: async ({ page, baselineFile, healJournalDir, captureBaselines }, use, testInfo) => {
    const path = baselineFile ?? `apps/${testInfo.project.name}/baselines.json`;
    const baselines = await loadBaselines(path);
    const journal = new HealJournal();
    const captured = new Map<string, Baseline>();

    const healing: Healing = {
      async locator(selector) {
        const key = baselineKey(page.url(), selector);
        const baseline = baselines.get(key);

        if (baseline === undefined) {
          if (captureBaselines) captured.set(key, await captureBaseline(page, selector));
          // No baseline means no healing — the selector stands or falls on its
          // own, exactly as it would without this fixture.
          return page.locator(selector);
        }

        const { locator, record } = await resolveLocator(page, baseline);
        journal.record(record);

        if (locator === null) {
          throw new Error(
            `Could not resolve "${selector}" (${record.status}).\n` +
              `  was:      ${record.was}\n` +
              `  evidence: ${record.evidence}` +
              record.alternatives.map((rival) => `\n  rival:    ${rival}`).join(''),
          );
        }
        return locator;
      },
      records: () => journal.all(),
    };

    await use(healing);

    const records = journal.all();
    if (records.length > 0) {
      await writeHealRecords(healJournalDir, testInfo.titlePath.join(' '), records);
      if (journal.summarise().notIntact.length > 0) {
        await testInfo.attach('heals.txt', {
          body: formatHeals(records),
          contentType: 'text/plain',
        });
      }
    }

    // One guard, at the point of capture: `captured` only ever holds something
    // when this run asked for baselines. A second check here would read as
    // belt-and-braces and is worse than that — two guards for one rule means
    // neither can be shown to be doing the work, which a surviving mutation said
    // out loud.
    if (captured.size > 0) {
      for (const [key, baseline] of captured) baselines.set(key, baseline);
      await saveBaselines(path, baselines);
    }
  },
});

export { expect };
