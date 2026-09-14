import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { FAULT_ENV, formatFaultVerdicts, judgeFaultRun, type FaultReport } from '../qe/fault.js';
import { PLAYWRIGHT_CLI } from '../tool-paths.js';

/**
 * Runs specs with every server response corrupted, and refuses any that stay green.
 * See `src/qe/fault.ts` for what is corrupted and how each outcome is judged.
 */

const run = promisify(execFile);
const RESULTS = 'artifacts/results-fault.json';
const PLAYWRIGHT = PLAYWRIGHT_CLI;

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: npm run fault-check -- <spec file> [<spec file> ...]');
  console.error('  Runs each spec with its server responses replaced by a 500. A spec that');
  console.error('  still passes asserts nothing the server decides.');
  process.exit(2);
}

const missing = files.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`No such spec file: ${missing.join(', ')}`);
  process.exit(2);
}

const startedAt = Date.now();
try {
  // Its own output and report folders. Run from inside another Playwright run — the
  // integration test, or the post-run gate — a shared `test-results/` is cleared at
  // startup and takes the outer run's in-progress trace files with it.
  await run(
    process.execPath,
    [PLAYWRIGHT, 'test', ...files, '--output', 'artifacts/fault-check/test-results'],
    {
      env: {
        ...process.env,
        [FAULT_ENV]: '1',
        PLAYWRIGHT_HTML_OUTPUT_DIR: 'artifacts/fault-check/report',
      },
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
} catch {
  // Failing is the expected outcome under the fault. What it means is judged below,
  // from the results file rather than from the exit code.
}

let report: FaultReport;
try {
  // A run that writes nothing leaves the previous results behind, and judging those
  // would report on specs this run never executed.
  if ((await stat(RESULTS)).mtimeMs < startedAt) throw new Error('stale');
  report = JSON.parse(await readFile(RESULTS, 'utf8')) as FaultReport;
} catch {
  console.error(`The fault run wrote no fresh ${RESULTS}, so nothing was checked.`);
  process.exit(2);
}

const { lines, problems } = formatFaultVerdicts(judgeFaultRun(report));
console.log('Fault check — every server response replaced with a 500\n');
for (const line of lines) console.log(`  ${line}`);

if (problems.length > 0) {
  console.log('\nRefused:');
  for (const problem of problems) console.log(`  ✗ ${problem}`);
  process.exit(1);
}
console.log('\nEvery judged spec noticed the fault.');
