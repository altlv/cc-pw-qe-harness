import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Baseline, HealRecord } from '../tools/heal.js';

/**
 * Where a baseline lives between runs.
 *
 * Healing is only meaningful across time: "this selector used to point at *that*"
 * needs a *used to*. Without somewhere to keep it, `resolveLocator` can only
 * compare a page against itself, which is a demonstration rather than a feature.
 *
 * A committed file rather than a database, deliberately. The baselines are part
 * of the tests: they change when the tests change, they belong in the same
 * review, and a heal proposal is only reviewable if the thing it healed *from* is
 * visible in the diff.
 */

const FORMAT_VERSION = 1;

interface BaselineFile {
  version: number;
  baselines: Record<string, Baseline>;
}

/**
 * How a baseline is addressed.
 *
 * Path and selector, and deliberately not the host: the same test runs against
 * local, test and prod, and a baseline that only matched one of them would be
 * recaptured on every environment switch — which means never being older than
 * the current run, which means never detecting anything.
 */
export function baselineKey(url: string, selector: string): string {
  let path: string;
  try {
    path = new URL(url).pathname.replace(/\/+$/, '') || '/';
  } catch {
    path = url;
  }
  return `${path}::${selector}`;
}

/** Reads a baseline file. A missing file is an empty set, not an error. */
export async function loadBaselines(path: string): Promise<Map<string, Baseline>> {
  const raw = await readFile(resolve(path), 'utf8').catch(() => null);
  if (raw === null) return new Map();

  const parsed = JSON.parse(raw) as BaselineFile;
  if (parsed.version !== FORMAT_VERSION) {
    // Silently ignoring a format we do not understand would present an empty set
    // as "nothing has a baseline yet", and every locator would look newly
    // captured rather than unverified.
    throw new Error(
      `${path} is baseline format v${parsed.version}; this harness reads v${FORMAT_VERSION}.`,
    );
  }
  return new Map(Object.entries(parsed.baselines ?? {}));
}

/** Writes a baseline file, keys sorted so a recapture makes a readable diff. */
export async function saveBaselines(path: string, baselines: Map<string, Baseline>): Promise<void> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });

  const sorted: Record<string, Baseline> = {};
  for (const key of [...baselines.keys()].sort()) sorted[key] = baselines.get(key)!;

  const file: BaselineFile = { version: FORMAT_VERSION, baselines: sorted };
  await writeFile(target, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
}

/**
 * Records what happened to one test's locators.
 *
 * One file per test rather than one shared log: Playwright runs tests in parallel
 * workers, and several processes appending to a single file is the kind of shared
 * mutable state that already made this harness's own integration tests flaky.
 */
export async function writeHealRecords(
  dir: string,
  name: string,
  records: readonly HealRecord[],
): Promise<string> {
  const safe = name.replace(/[^a-z0-9]+/gi, '-').slice(0, 120);
  const target = join(resolve(dir), `${safe}-${process.pid}.json`);
  await mkdir(resolve(dir), { recursive: true });
  await writeFile(target, JSON.stringify(records, null, 2), 'utf8');
  return target;
}

/** Everything the run journalled, for the gate. An absent directory means none. */
export async function loadHealRecords(dir: string): Promise<HealRecord[]> {
  const entries = await readdir(resolve(dir), { withFileTypes: true }).catch(() => []);
  const records: HealRecord[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const raw = await readFile(join(resolve(dir), entry.name), 'utf8').catch(() => null);
    if (raw === null) continue;
    records.push(...(JSON.parse(raw) as HealRecord[]));
  }
  return records;
}
