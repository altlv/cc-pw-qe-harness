import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

/**
 * A git repository in a temp directory, for tests that create worktrees, take locks or
 * commit — never this repository, whose worktree list and history a test must not touch.
 *
 * It holds what a run's preflight reads: a committed lockfile, a committed test design
 * for todo-fixture, and a `node_modules` with a real file in it, so a test can check the
 * file survives and not just the folder.
 */

const exec = promisify(execFile);

export const git = (repo: string, ...args: string[]) =>
  exec('git', ['-C', repo, ...args], { windowsHide: true });

export const DESIGN = 'apps/todo-fixture/designs/add.md';

export const designReport = (cases: string): string => `---
report: test-design
target: apps/todo-fixture
date: 2026-09-14
author: test-planner
confidence: medium
evidence:
  direct: 0
  inferred: 0
  claimed: 0
findings: []
not_covered:
  - concurrency
${cases}---

Body.
`;

export const ONE_CASE = `cases:
  - id: C1
    level: e2e
    technique: equivalence partitioning
    summary: A todo typed and submitted appears in the list.
`;

export async function throwawayRepo(): Promise<{ parent: string; repo: string }> {
  const parent = await mkdtemp(join(tmpdir(), 'harness-repo-'));
  const repo = join(parent, 'subject');
  mkdirSync(join(repo, 'apps', 'todo-fixture', 'designs'), { recursive: true });
  mkdirSync(join(repo, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(repo, 'node_modules', 'pkg', 'index.js'), 'module.exports = 1;\n');
  writeFileSync(join(repo, '.gitignore'), 'node_modules/\nartifacts/\n');
  writeFileSync(join(repo, 'package-lock.json'), '{\n  "lockfileVersion": 3\n}\n');
  writeFileSync(join(repo, DESIGN), designReport(ONE_CASE));
  await git(repo, 'init', '--quiet');
  await git(repo, 'config', 'user.email', 'harness@example.invalid');
  await git(repo, 'config', 'user.name', 'harness test');
  await git(repo, 'config', 'core.autocrlf', 'false');
  await git(repo, 'add', '.');
  await git(repo, 'commit', '--quiet', '-m', 'base');
  return { parent, repo };
}
