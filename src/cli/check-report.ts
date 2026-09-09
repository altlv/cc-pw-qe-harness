import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { auditReport, parseReport, type ReportProblem } from '../qe/report.js';

async function findReports(target: string): Promise<string[]> {
  const entries = await readdir(target, { withFileTypes: true }).catch(() => null);
  if (entries === null) return [target]; // a single file path
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = join(target, entry.name);
      if (entry.isDirectory()) return findReports(full);
      return entry.name.endsWith('.md') ? [full] : [];
    }),
  );
  return nested.flat();
}

const target = resolve(process.argv[2] ?? 'reports');
const files = (await findReports(target)).sort();

if (files.length === 0) {
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
