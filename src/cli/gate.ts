import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { analyzeSpec, type QualityFinding } from '../quality/assertions.js';
import { loadHealRecords } from '../qe/baselines.js';
import { assessGate, type RunStats } from '../qe/gate.js';
import { formatVerdict } from '../qe/verdict.js';

interface PlaywrightSpec {
  title: string;
  ok: boolean;
  tests?: { status?: string; results?: { status?: string }[] }[];
}
interface PlaywrightSuite {
  title?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

function walk(suite: PlaywrightSuite, out: PlaywrightSpec[] = []): PlaywrightSpec[] {
  for (const spec of suite.specs ?? []) out.push(spec);
  for (const child of suite.suites ?? []) walk(child, out);
  return out;
}

async function findSpecs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return findSpecs(full);
      // Unit and integration tests are held to the same standard as specs.
      return /\.(spec|test)\.ts$/.test(entry.name) ? [full] : [];
    }),
  );
  return files.flat();
}

/** Most recent mtime of any source or test file, in ms. */
async function newestSourceMtime(roots: string[]): Promise<number> {
  let newest = 0;
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'scans') continue;
        await walk(full);
      } else if (/\.(ts|mjs|js|html)$/.test(entry.name)) {
        const info = await stat(full).catch(() => null);
        if (info !== null) newest = Math.max(newest, info.mtimeMs);
      }
    }
  }
  await Promise.all(roots.map((root) => walk(resolve(root))));
  return newest;
}

const resultsPath = resolve(process.argv[2] ?? 'artifacts/results.json');

const raw = await readFile(resultsPath, 'utf8').catch(() => null);
if (raw === null) {
  console.error(`No test results at ${resultsPath}. Run \`npm test\` first.`);
  process.exit(2);
}

const report = JSON.parse(raw) as {
  stats?: Partial<RunStats> & { startTime?: string };
  suites?: PlaywrightSuite[];
};

/**
 * A verdict about code that has since changed is not a verdict.
 *
 * This is not hypothetical: `--reporter=line` on the command line replaces the
 * reporters configured in playwright.config.ts, so a run made that way leaves
 * results.json untouched. The gate then reads an old file and reports confidently
 * on a state of the world that no longer exists.
 */
const ranAt = Date.parse(report.stats?.startTime ?? '');
if (!Number.isNaN(ranAt)) {
  const newest = await newestSourceMtime(['src', 'tests', 'apps']);
  if (newest > ranAt) {
    console.error(
      `Test results are stale: the run started ${new Date(ranAt).toISOString()} but source has ` +
        `changed since (${new Date(newest).toISOString()}).\nRun \`npm test\` again — a verdict ` +
        `on code that has changed is not a verdict.`,
    );
    process.exit(2);
  }
}
const stats: RunStats = {
  expected: report.stats?.expected ?? 0,
  unexpected: report.stats?.unexpected ?? 0,
  flaky: report.stats?.flaky ?? 0,
  skipped: report.stats?.skipped ?? 0,
};

const allSpecs = (report.suites ?? []).flatMap((suite) => walk(suite));
const failedTests = allSpecs.filter((spec) => !spec.ok).map((spec) => spec.title);
const flakyTests = allSpecs
  .filter((spec) => spec.tests?.some((t) => t.status === 'flaky'))
  .map((spec) => spec.title);

const qualityFindings: { file: string; finding: QualityFinding }[] = [];
for (const root of ['apps', 'tests']) {
  for (const file of await findSpecs(resolve(root))) {
    for (const finding of analyzeSpec(await readFile(file, 'utf8'))) {
      qualityFindings.push({ file, finding });
    }
  }
}

// What happened to every locator the run resolved through a baseline. Written
// one file per test by the healing fixture, because parallel workers appending
// to one log is shared mutable state.
const heals = await loadHealRecords('artifacts/heals');

const verdict = assessGate({
  stats,
  failedTests,
  flakyTests,
  qualityFindings,
  heals,
  phase: 'release',
});

console.log(formatVerdict(verdict));

// Output path is an argument so several gates can run without fighting over one
// file — two runs writing the same path is shared mutable state, and it made the
// harness's own integration tests flaky.
const verdictPath = resolve(process.argv[3] ?? 'artifacts/verdict.json');
await mkdir(dirname(verdictPath), { recursive: true });
await writeFile(verdictPath, JSON.stringify(verdict, null, 2), 'utf8');
console.log(`\nWritten to ${verdictPath}`);

process.exit(verdict.verdict === 'FAIL' ? 1 : 0);
