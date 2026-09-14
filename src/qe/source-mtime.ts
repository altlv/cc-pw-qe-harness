import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Most recent mtime of any source or test file, in ms.
 *
 * Shared by the release gate and `npm run plan:facts`, which ask the same question —
 * were these results produced before the code last changed? — and must never answer
 * it two different ways.
 */
export async function newestSourceMtime(roots: string[]): Promise<number> {
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
