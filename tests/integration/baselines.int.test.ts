import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  baselineKey,
  loadBaselines,
  loadHealRecords,
  saveBaselines,
  writeHealRecords,
} from '../../src/qe/baselines.js';
import type { Baseline, HealRecord } from '../../src/tools/heal.js';

/**
 * The store, through the real filesystem.
 *
 * Healing only means anything across time, and across time means a file. What is
 * provable only here is the behaviour around that file: an absent one, one from a
 * format this harness does not understand, and several parallel workers writing
 * their journals at once.
 */

const baseline: Baseline = {
  selector: '#save',
  fingerprint: {
    tag: 'button',
    role: 'button',
    name: 'Save',
    testId: null,
    fieldName: null,
    id: 'save',
    type: null,
    href: null,
    ancestors: ['html', 'body', 'form'],
    siblingIndex: 0,
    nearbyText: null,
    constraints: null,
  },
  url: 'https://app.test/checkout',
  recordedAt: '2026-09-11T00:00:00.000Z',
};

const record: HealRecord = {
  selector: '#save',
  status: 'healed',
  was: 'button "Save"',
  now: 'button "Save"',
  proposed: 'role=button[name="Save"]',
  evidence: 'score 0.72; agreed on roleAndName',
  url: 'https://app.test/checkout',
  at: '2026-09-11T00:00:00.000Z',
  alternatives: [],
};

let dir: string;

test.beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'baselines-'));
});

test.afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test.describe('addressing a baseline', () => {
  test('should ignore the host so one baseline serves every environment', () => {
    expect(
      baselineKey('https://app.test/checkout', '#save'),
      'the same test runs against local, test and prod; a per-host key would be recaptured on every switch and so never be older than the run it checks',
    ).toBe(baselineKey('http://localhost:3000/checkout', '#save'));
  });

  test('should keep the path, because the same selector means different things on different pages', () => {
    expect(baselineKey('https://app.test/checkout', '#save')).not.toBe(
      baselineKey('https://app.test/settings', '#save'),
    );
  });

  test('should treat a trailing slash as the same page', () => {
    expect(baselineKey('https://app.test/cart/', '#save')).toBe(
      baselineKey('https://app.test/cart', '#save'),
    );
  });
});

test.describe('the baseline file', () => {
  test('should round-trip through the filesystem', async () => {
    const path = join(dir, 'baselines.json');
    await saveBaselines(path, new Map([['/checkout::#save', baseline]]));

    const loaded = await loadBaselines(path);
    expect(loaded.get('/checkout::#save')).toEqual(baseline);
  });

  test('should treat a missing file as no baselines rather than an error', async () => {
    const loaded = await loadBaselines(join(dir, 'never-written.json'));
    expect(
      loaded.size,
      'the first run of a new suite has no baselines, and that is normal rather than broken',
    ).toBe(0);
  });

  test('should refuse a format it does not understand', async () => {
    const path = join(dir, 'future.json');
    await writeFile(path, JSON.stringify({ version: 99, baselines: {} }), 'utf8');

    await expect(
      loadBaselines(path),
      'silently reading it as empty would present every locator as newly captured rather than unverified',
    ).rejects.toThrow(/v99/);
  });

  test('should write keys in a stable order so a recapture is reviewable', async () => {
    const path = join(dir, 'baselines.json');
    await saveBaselines(
      path,
      new Map([
        ['/z::#last', baseline],
        ['/a::#first', baseline],
      ]),
    );

    const written = await readFile(path, 'utf8');
    expect(
      written.indexOf('/a::#first'),
      'an unordered file makes every recapture look like a whole-file rewrite, and a heal is only reviewable if the diff is readable',
    ).toBeLessThan(written.indexOf('/z::#last'));
  });
});

test.describe('the heal journal on disk', () => {
  test('should round-trip records written by separate tests', async () => {
    await writeHealRecords(dir, 'checkout works', [record]);
    await writeHealRecords(dir, 'search works', [{ ...record, selector: '#search' }]);

    const loaded = await loadHealRecords(dir);
    expect(
      loaded.map((entry) => entry.selector).sort(),
      'each test writes its own file precisely so parallel workers do not overwrite each other',
    ).toEqual(['#save', '#search']);
  });

  test('should treat an absent directory as nothing journalled', async () => {
    expect(await loadHealRecords(join(dir, 'no-such-dir'))).toEqual([]);
  });

  test('should not let a test title become a path', async () => {
    const written = await writeHealRecords(dir, '../../escaped/../../title', [record]);
    expect(
      written.startsWith(dir),
      'a test title is authored text, and letting it steer a write path is how an artefact lands outside its directory',
    ).toBe(true);
  });
});
