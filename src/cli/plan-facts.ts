import { readFile } from 'node:fs/promises';
import {
  countByProject,
  formatFacts,
  freshness,
  type PlaywrightReport,
  type RunFacts,
} from '../qe/facts.js';
import { newestSourceMtime } from '../qe/source-mtime.js';

/**
 * Prints the numbers `PLAN.md` quotes, and refuses to vouch for any that are stale.
 *
 * Read-only: it runs nothing, so it is quick and cannot disturb a tree. The order that
 * produces quotable numbers is `npm run mutate`, then `npm test` (mutate rewrites and
 * restores source files, which makes earlier results stale), then
 * `npm run test:external`, then this.
 */

async function readJson<T>(path: string): Promise<T | null> {
  const raw = await readFile(path, 'utf8').catch(() => null);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const newest = await newestSourceMtime(['src', 'tests', 'apps']);

const asRun = (report: PlaywrightReport | null): RunFacts | null =>
  report === null
    ? null
    : {
        counts: countByProject(report),
        freshness: freshness(Date.parse(report.stats?.startTime ?? ''), newest),
      };

const local = asRun(await readJson<PlaywrightReport>('artifacts/results.json'));
const external = asRun(await readJson<PlaywrightReport>('artifacts/results-external.json'));
const record = await readJson<{ caught: number; total: number; ranAt: string }>(
  'artifacts/mutation.json',
);
const mutation =
  record === null
    ? null
    : {
        caught: record.caught,
        total: record.total,
        freshness: freshness(Date.parse(record.ranAt), newest),
      };

const { lines, problems } = formatFacts({ local, external, mutation });

console.log(lines.join('\n'));
if (problems.length > 0) {
  console.error(
    `\nNot safe to quote yet:\n${problems.map((problem) => `  ✗ ${problem}`).join('\n')}`,
  );
  process.exit(1);
}
console.log('\nAll current — safe to quote.');
