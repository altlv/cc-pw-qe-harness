import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { analyzeSpec, formatFindings } from '../quality/assertions.js';

async function findSpecs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return findSpecs(full);
      return entry.name.endsWith('.spec.ts') ? [full] : [];
    }),
  );
  return files.flat();
}

const roots = process.argv.slice(2);
const targets = (roots.length > 0 ? roots : ['apps', 'tests']).map((root) => resolve(root));

const found = await Promise.all(targets.map(findSpecs));
const specs = found.flat().sort();

let failed = 0;
for (const spec of specs) {
  const findings = analyzeSpec(await readFile(spec, 'utf8'));
  if (findings.length > 0) failed += findings.length;
  console.log(formatFindings(spec, findings));
}

console.log(`\n${specs.length} spec file(s), ${failed} finding(s).`);
process.exit(failed > 0 ? 1 : 0);
