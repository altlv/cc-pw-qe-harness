import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { TSX_CLI } from '../../src/tool-paths.js';

const exec = promisify(execFile);
const REPO = resolve(process.cwd());
const TSX = TSX_CLI;

/**
 * The harness must load its own `.env` and nobody else's.
 *
 * Subjects under test carry their own environment files — mcpa-bot has one holding
 * its chat provider and port. `src/env.ts` used to load `.env` relative to the
 * working directory, so running a harness CLI from inside a subject would have read
 * that subject's variables into the harness process and left the harness's own key
 * missing. This has to be an integration test: the failure only exists across a
 * process boundary with a different cwd, which is exactly what a unit test cannot see.
 */

/** Runs a snippet with the harness's env module loaded, from an arbitrary directory. */
async function runFrom(cwd: string, source: string): Promise<string> {
  const file = join(cwd, 'probe.mts');
  await writeFile(file, source, 'utf8');
  const { stdout } = await exec(process.execPath, [TSX, file], { cwd, windowsHide: true });
  return stdout.trim();
}

test.describe('harness environment loading', () => {
  test('should resolve its own .env no matter where the command was run from', async () => {
    const elsewhere = await mkdtemp(join(tmpdir(), 'harness-env-'));
    try {
      // On Windows an absolute path in an ESM specifier must be a file:// URL.
      const envModule = pathToFileURL(resolve(REPO, 'src/env.ts')).href;
      const printed = await runFrom(
        elsewhere,
        `import { harnessEnvFile } from '${envModule}';\nconsole.log(harnessEnvFile());\n`,
      );
      expect(
        printed,
        `run from ${elsewhere}, the harness resolved ${printed} — it must always be
the repo's own .env, or it will read a subject's secrets instead of its key`,
      ).toBe(resolve(REPO, '.env'));
    } finally {
      await rm(elsewhere, { recursive: true, force: true });
    }
  });

  test('should not read a .env belonging to the directory it was run from', async () => {
    // The concrete hazard, staged: a subject folder with its own .env holding a
    // variable the harness never defines. Loading it would be silent — the value
    // simply appears in process.env and nothing says where it came from.
    const subject = await mkdtemp(join(tmpdir(), 'harness-subject-'));
    try {
      await writeFile(join(subject, '.env'), 'SUBJECT_ONLY_SECRET=leaked\n', 'utf8');
      // On Windows an absolute path in an ESM specifier must be a file:// URL.
      const envModule = pathToFileURL(resolve(REPO, 'src/env.ts')).href;
      const printed = await runFrom(
        subject,
        `import '${envModule}';\nconsole.log(process.env.SUBJECT_ONLY_SECRET ?? 'absent');\n`,
      );
      expect(
        printed,
        "the harness picked up a variable from the subject's .env — a subject's secrets must never reach the harness process",
      ).toBe('absent');
    } finally {
      await rm(subject, { recursive: true, force: true });
    }
  });
});
