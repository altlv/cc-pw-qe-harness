import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { auditReport, parseReport, type ReportProblem } from '../qe/report.js';

async function findReports(target: string): Promise<string[]> {
  const info = await stat(target).catch(() => null);
  if (info === null) return [];
  // A file path was given directly rather than a directory to walk.
  if (info.isFile()) return [target];

  const entries = await readdir(target, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = join(target, entry.name);
      if (entry.isDirectory()) return findReports(full);
      return entry.name.endsWith('.md') ? [full] : [];
    }),
  );
  return nested.flat();
}

const explicit = process.argv[2];
const target = resolve(explicit ?? 'reports');
const files = (await findReports(target)).sort();

if (files.length === 0) {
  // A path someone asked for by name and that does not exist is a mistake — most
  // likely a typo, or a file that was never committed. Exiting 0 here is how a CI
  // step "passed" while checking nothing at all.
  if (explicit !== undefined) {
    console.error(`No reports found at ${target}. Check the path exists and is committed.`);
    process.exit(2);
  }
  console.log(`No reports found under ${target}.`);
  process.exit(0);
}

let errors = 0;
let warnings = 0;

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const parsed = parseReport(source);

  const problems: ReportProblem[] = parsed.ok ? auditReport(parsed.report) : parsed.problems;
  const fileErrors = problems.filter((p) => p.level === 'error');
  const fileWarnings = problems.filter((p) => p.level === 'warning');
  errors += fileErrors.length;
  warnings += fileWarnings.length;

  if (problems.length === 0) {
    console.log(`${file}: OK${parsed.ok ? ` (${parsed.report.report})` : ''}`);
    continue;
  }

  console.log(file);
  for (const problem of problems) {
    console.log(`  ${problem.level === 'error' ? 'ERROR  ' : 'warning'} ${problem.message}`);
  }
}

console.log(`\n${files.length} report(s), ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors > 0 ? 1 : 0);
