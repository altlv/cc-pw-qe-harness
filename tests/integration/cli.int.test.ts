import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const REPO = resolve(process.cwd());

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs a harness CLI the way a person or CI actually runs it — a real process, real
 * arguments, a real exit code. Asserting on the exit code matters: CI branches on it,
 * and a CLI that prints an error but exits 0 is a check that silently passes.
 */
const TSX = resolve(REPO, 'node_modules/tsx/dist/cli.mjs');

async function cli(script: string, args: string[] = []): Promise<CliResult> {
  try {
    // Invoke node against tsx's entry point rather than the `npx` shim: on Windows
    // a .cmd shim through execFile without a shell fails with EINVAL, and using a
    // shell would mean concatenating arguments instead of escaping them.
    const { stdout, stderr } = await exec(
      process.execPath,
      [TSX, join('src', 'cli', script), ...args],
      { cwd: REPO, windowsHide: true },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const e = error as { code?: number | string; stdout?: string; stderr?: string };
    if (typeof e.code === 'string') {
      throw new Error(`could not spawn the CLI (${e.code}) — the test harness is broken`);
    }
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'harness-int-'));
}

const HONEST_REPORT = `---
report: testability
target: apps/example
date: 2026-09-10
author: integration-test
confidence: high
evidence:
  direct: 1
  inferred: 0
  claimed: 0
findings:
  - id: F1
    severity: major
    evidence: direct
    summary: The primary action has no stable selector.
    basis: Selector ladder in docs/conventions.md
not_covered:
  - mobile viewports
not_run: []
---

Body.
`;

const DISHONEST_REPORT = HONEST_REPORT.replace(
  '    severity: major\n    evidence: direct',
  '    severity: blocker\n    evidence: claimed',
);

test.describe('check-report CLI', () => {
  test('should accept an honest report and exit 0', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'good.md'), HONEST_REPORT, 'utf8');

    const result = await cli('check-report.ts', [dir]);

    expect(result.code, 'an honest report was rejected — the checker is too strict to trust').toBe(
      0,
    );
    expect(result.stdout).toContain('0 error(s)');
    await rm(dir, { recursive: true, force: true });
  });

  test('should reject a blocker built on claimed evidence and exit 1', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'bad.md'), DISHONEST_REPORT, 'utf8');

    const result = await cli('check-report.ts', [dir]);

    expect(
      result.code,
      'a blocker resting on claimed evidence was accepted — the format stops meaning anything',
    ).toBe(1);
    expect(result.stdout).toContain('ERROR');
    await rm(dir, { recursive: true, force: true });
  });

  // Regression for the first CI failure: an explicitly named path that does not
  // exist crashed with an unhandled ENOENT and a stack trace.
  test('should fail cleanly when an explicitly named path does not exist', async () => {
    const result = await cli('check-report.ts', ['definitely/not/here']);

    expect(result.code, 'a named path that is absent must be an error, not a pass').toBe(2);
    expect(result.stderr).toContain('No reports found');
    expect(result.stderr, 'should explain, not dump a stack trace').not.toContain('at async');
  });

  test('should accept a single file path as well as a directory', async () => {
    const dir = await tempDir();
    const file = join(dir, 'one.md');
    await writeFile(file, HONEST_REPORT, 'utf8');

    const result = await cli('check-report.ts', [file]);

    expect(result.code, 'a single file path was not accepted, only directories').toBe(0);
    expect(result.stdout).toContain('1 report(s)');
    await rm(dir, { recursive: true, force: true });
  });
});

test.describe('gate CLI', () => {
  async function resultsFile(
    dir: string,
    stats: Record<string, unknown>,
    startTime = new Date().toISOString(),
  ): Promise<string> {
    const path = join(dir, 'results.json');
    await writeFile(path, JSON.stringify({ stats: { startTime, ...stats }, suites: [] }), 'utf8');
    return path;
  }

  test('should fail cleanly when there are no results at all', async () => {
    const result = await cli('gate.ts', ['definitely/not/results.json']);

    expect(result.code, 'missing results should be a usage error, not a verdict').toBe(2);
    expect(result.stderr).toContain('No test results');
  });

  // Regression: the gate once rendered a confident verdict from hours-old results,
  // because --reporter=line on the CLI replaces the configured JSON reporter.
  test('should refuse results older than the source it is judging', async () => {
    const dir = await tempDir();
    const stale = await resultsFile(
      dir,
      { expected: 10, unexpected: 0, flaky: 0, skipped: 0 },
      '2001-01-01T00:00:00.000Z',
    );

    const result = await cli('gate.ts', [stale]);

    expect(result.code, 'a verdict on changed code is not a verdict').toBe(2);
    expect(result.stderr).toContain('stale');
    await rm(dir, { recursive: true, force: true });
  });

  test('should write a verdict file for a fresh clean run', async () => {
    const dir = await tempDir();
    const fresh = await resultsFile(dir, { expected: 12, unexpected: 0, flaky: 0, skipped: 0 });
    // Own output path: two gate runs sharing artifacts/verdict.json is shared
    // mutable state, and it made this test flaky under parallel workers.
    const out = join(dir, 'verdict.json');

    const result = await cli('gate.ts', [fresh, out]);

    expect(result.code).toBe(0);
    const verdict = JSON.parse(await readFile(out, 'utf8')) as { verdict: string };
    expect(['PASS', 'CONDITIONAL']).toContain(verdict.verdict);
    await rm(dir, { recursive: true, force: true });
  });

  test('should FAIL and exit 1 when tests failed', async () => {
    const dir = await tempDir();
    const failed = await resultsFile(dir, { expected: 8, unexpected: 2, flaky: 0, skipped: 0 });

    const result = await cli('gate.ts', [failed, join(dir, 'verdict.json')]);

    expect(result.code, 'failing tests did not produce a non-zero exit — CI would go green').toBe(
      1,
    );
    expect(result.stdout).toContain('FAIL');
    await rm(dir, { recursive: true, force: true });
  });
});

test.describe('assert-quality CLI', () => {
  test('should pass over the repo’s own specs', async () => {
    const result = await cli('assert-quality.ts', ['apps', 'tests']);

    expect(result.code, `quality gate failed:\n${result.stdout}`).toBe(0);
    expect(result.stdout).toContain('0 finding(s)');
  });

  test('should fail on a spec that asserts nothing', async () => {
    const dir = await tempDir();
    await mkdir(join(dir, 'nested'), { recursive: true });
    await writeFile(
      join(dir, 'nested', 'vacuous.spec.ts'),
      "import { test } from '@playwright/test';\n" +
        "test('proves nothing', async ({ page }) => {\n  await page.goto('/');\n});\n",
      'utf8',
    );

    const result = await cli('assert-quality.ts', [dir]);

    expect(result.code, 'a spec that asserts nothing was accepted by the gate').toBe(1);
    expect(result.stdout).toContain('no-assertion');
    await rm(dir, { recursive: true, force: true });
  });
});
