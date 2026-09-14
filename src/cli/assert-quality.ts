import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { analyzeSpec, formatFindings } from '../quality/assertions.js';

const SPEC = /\.(spec|test)\.ts$/;

/**
 * Spec files under a directory, or the file itself when one is named. The post-run
 * gate names the exact files a run changed; walking their directories instead would
 * refuse a run for findings in specs it never touched.
 */
async function findSpecs(path: string): Promise<string[]> {
  const info = await stat(path).catch(() => null);
  if (info === null) {
    console.error(`No such file or directory: ${path}`);
    process.exit(2);
  }
  if (info.isFile()) return [path];

  const entries = await readdir(path, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(path, entry.name);
      if (entry.isDirectory()) return findSpecs(full);
      // Unit and integration tests are held to the same standard as specs.
      return SPEC.test(entry.name) ? [full] : [];
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
