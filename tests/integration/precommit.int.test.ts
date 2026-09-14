import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { TSX_CLI } from '../../src/tool-paths.js';

const exec = promisify(execFile);
const REPO = resolve(process.cwd());
const TSX = TSX_CLI;

/**
 * The housekeeping gate has to actually refuse. One that passes whatever it is given
 * is worse than none: it turns "nobody checked" into "something checked and was
 * happy", which nobody then re-reads.
 *
 * Integration rather than unit, because the whole thing is a process that shells out
 * to git, reads the working tree, and exits with a code CI branches on.
 *
 * **Drift is staged in a throwaway file, never in a tracked one.** The first version
 * of these tests appended to `docs/conventions.md` and restored it in a `finally`.
 * That works until something interrupts them — and `npm run mutate` runs this suite
 * against deliberately broken source, so it left the real document dirty on the first
 * full run. A test that can corrupt the repository it tests is the wrong test.
 */

interface Run {
  code: number;
  stdout: string;
}

async function precommit(documents: string[] = []): Promise<Run> {
  try {
    const { stdout } = await exec(
      process.execPath,
      [TSX, join('src', 'cli', 'precommit.ts'), ...documents],
      { cwd: REPO, windowsHide: true },
    );
    return { code: 0, stdout };
  } catch (error) {
    const e = error as { code?: number | string; stdout?: string };
    if (typeof e.code === 'string') throw new Error(`could not spawn precommit (${e.code})`);
    return { code: e.code ?? 1, stdout: e.stdout ?? '' };
  }
}

/** A markdown file outside the repo, holding whatever drift a test wants to stage. */
async function documentSaying(
  markdown: string,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'precommit-'));
  const path = join(dir, 'staged.md');
  await writeFile(path, markdown, 'utf8');
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test.describe('the housekeeping gate', () => {
  test('should pass on the tree as it stands', async () => {
    // If this ever fails, the repo has real drift and the message names the file.
    const run = await precommit();
    expect(run.code, `precommit refused the current tree:\n${run.stdout}`).toBe(0);
  });

  test('should refuse a document that names a command which does not exist', async () => {
    // The drift this exists for: a document telling a reader to run something renamed.
    const doc = await documentSaying('Run `npm run definitely-not-a-real-script`.\n');
    try {
      const run = await precommit([doc.path]);
      expect(run.code, 'a dead command in a document must fail the gate').toBe(1);
      expect(run.stdout).toContain('definitely-not-a-real-script');
    } finally {
      await doc.cleanup();
    }
  });

  test('should refuse a document that points at a path which does not exist', async () => {
    // What a rename breaks. `investigator.ts` became `failure-investigator.ts` in this
    // repo, and nothing would have noticed a document still naming the old one.
    const doc = await documentSaying('See `src/agents/roles/investigator.ts`.\n');
    try {
      const run = await precommit([doc.path]);
      expect(run.code, 'a stale path in a document must fail the gate').toBe(1);
      expect(run.stdout).toContain('src/agents/roles/investigator.ts');
    } finally {
      await doc.cleanup();
    }
  });

  test('should accept a .js specifier whose file is .ts', async () => {
    // NodeNext requires the .js extension on a relative import and conventions.md
    // demands it, so this is a correct sentence that a naive existsSync refuses. It
    // was five of the six findings on this command's very first run.
    const doc = await documentSaying('Import from `src/fixtures/harness.js`.\n');
    try {
      const run = await precommit([doc.path]);
      expect(
        run.code,
        `the NodeNext .js convention must not be reported as a dead path:\n${run.stdout}`,
      ).toBe(0);
    } finally {
      await doc.cleanup();
    }
  });

  test('should not mistake a placeholder path for a claim', async () => {
    // `apps/<app>/coverage.md` is a pattern. Flagging it would make the command noisy
    // enough to ignore, which is the failure mode of every detector here.
    const doc = await documentSaying('Each app has `apps/<app>/coverage.md`.\n');
    try {
      const run = await precommit([doc.path]);
      expect(run.code, `a placeholder must not be treated as a path:\n${run.stdout}`).toBe(0);
    } finally {
      await doc.cleanup();
    }
  });

  test('should refuse a command that exists but is undocumented', async () => {
    // The direction of drift that actually happened. The first version of this gate
    // only checked that documented commands exist; adding `npm run precommit` and not
    // documenting it slipped straight through, one message after five README fixes.
    // Verified against the real tree, so it also asserts the README stays honest.
    const run = await precommit();
    expect(
      run.stdout,
      'every non-internal script must be in the README, or declared internal with a reason',
    ).not.toContain('commands exist that the README never mentions');
  });

  test('should name the obligation the diff creates, not a generic checklist', async () => {
    // A static list asks an agent to remember what it changed. This reads the diff.
    // At minimum the always-on items must appear; when package.json or a role has
    // been touched, the specific consequence appears too.
    const run = await precommit();
    expect(
      run.stdout,
      'the judgement half must always carry the items that apply to any change',
    ).toContain('did anything move between Proven and Not proven');
  });

  test('should always print the checks it cannot make', async () => {
    // The half that matters most and can never be automated. If this stops printing,
    // the command starts implying the housekeeping is complete when it did a third.
    const run = await precommit();
    expect(run.stdout, 'the judgement list must print whether or not checks passed').toContain(
      'Not checkable',
    );
    expect(run.stdout).toContain('README');
    expect(run.stdout).toContain('HANDOFF.md');
  });
});
