import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { TSX_CLI } from '../../src/tool-paths.js';

const exec = promisify(execFile);
const REPO = resolve(process.cwd());
const TSX = TSX_CLI;

/**
 * The fault check is a process that runs Playwright and judges its results file, so it
 * is tested as one: real specs, real exit codes. The probe spec carries one test the
 * fault must catch and one it must not, so both directions are checked against a spec
 * whose answer is known.
 */

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

async function faultCheck(args: string[]): Promise<Run> {
  try {
    const { stdout, stderr } = await exec(
      process.execPath,
      [TSX, join('src', 'cli', 'fault-check.ts'), ...args],
      // CI unset for the nested run: its config would otherwise refuse to reuse the
      // fixture server the outer run already started.
      { cwd: REPO, windowsHide: true, env: { ...process.env, CI: '' } },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code?: number | string; stdout?: string; stderr?: string };
    if (typeof e.code === 'string') throw new Error(`could not spawn the CLI (${e.code})`);
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

test.describe('fault-check CLI', () => {
  test('should refuse to run with no spec named', async () => {
    const run = await faultCheck([]);
    expect(run.code, 'a check given nothing must not exit 0').toBe(2);
  });

  test('should refuse a spec that does not exist', async () => {
    const run = await faultCheck(['apps/todo-fixture/tests/nope.spec.ts']);
    expect(run.code, 'a typo in a path must not read as a spec that passed the check').toBe(2);
    expect(run.stderr).toContain('No such spec file');
  });

  // Both runs write artifacts/results-fault.json, so they must not run at once.
  test.describe.configure({ mode: 'serial' });

  test('should refuse the probe spec that stays green and credit the one that fails', async () => {
    test.setTimeout(180_000);
    const run = await faultCheck(['tests/harness/fault-probe.ui.spec.ts']);
    expect(
      run.code,
      `a spec that passes over a corrupted server must fail the check:\n${run.stdout}${run.stderr}`,
    ).toBe(1);
    expect(run.stdout).toMatch(/survived\s+should keep what was typed in the input/);
    expect(run.stdout).toMatch(/caught\s+should list the todos the server returns/);
  });

  test('should pass a spec whose every test notices the fault', async () => {
    test.setTimeout(180_000);
    const run = await faultCheck(['apps/todo-fixture/tests/todos.api.spec.ts']);
    expect(
      run.code,
      `every todos API test asserts on the server's answer:\n${run.stdout}${run.stderr}`,
    ).toBe(0);
    expect(run.stdout).not.toContain('survived ');
  });
});
