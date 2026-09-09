import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { analyzeSpec, type QualityFinding } from '../quality/assertions.js';
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
      return entry.name.endsWith('.spec.ts') ? [full] : [];
    }),
  );
  return files.flat();
}

const resultsPath = resolve(process.argv[2] ?? 'artifacts/results.json');

const raw = await readFile(resultsPath, 'utf8').catch(() => null);
if (raw === null) {
  console.error(`No test results at ${resultsPath}. Run \`npm test\` first.`);
  process.exit(2);
}

const report = JSON.parse(raw) as { stats?: Partial<RunStats>; suites?: PlaywrightSuite[] };
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

const verdict = assessGate({ stats, failedTests, flakyTests, qualityFindings, phase: 'release' });

console.log(formatVerdict(verdict));

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/verdict.json', JSON.stringify(verdict, null, 2), 'utf8');
console.log('\nWritten to artifacts/verdict.json');

process.exit(verdict.verdict === 'FAIL' ? 1 : 0);
