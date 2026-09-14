import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  committedAt,
  createRunWorktree,
  freePort,
  headCommit,
  isRunWorktree,
  lockfileProblem,
  runsRoot,
  worktreeChanges,
} from '../../src/qe/run-worktree.js';
import { DESIGN, git, throwawayRepo } from './throwaway-repo.js';

/** Worktree isolation against a real git repository — a throwaway one. */

test.describe('a run worktree', () => {
  test('should hold exactly the run’s changes, at the base commit, beside the repository', async () => {
    const { parent, repo } = await throwawayRepo();
    const worktree = join(runsRoot(repo), 'e2e-coder-1');
    try {
      const base = await headCommit(repo);
      expect(await createRunWorktree(repo, 'e2e-coder-1', base)).toBe(worktree);

      expect(existsSync(join(worktree, 'package-lock.json')), 'checked out at the base').toBe(true);
      expect(await isRunWorktree(repo, worktree)).toBe(true);
      expect(await worktreeChanges(worktree), 'a fresh worktree has changed nothing').toEqual([]);

      // A person edits the main checkout while the run works: none of it reaches the run.
      writeFileSync(join(repo, 'apps', 'todo-fixture', 'person.txt'), 'edited by a person');
      mkdirSync(join(worktree, 'apps', 'todo-fixture', 'tests'), { recursive: true });
      writeFileSync(join(worktree, 'apps', 'todo-fixture', 'tests', 'add.ui.spec.ts'), '// run');
      expect(
        await worktreeChanges(worktree),
        'the diff from base is the run’s work and nobody else’s',
      ).toEqual(['apps/todo-fixture/tests/add.ui.spec.ts']);
    } finally {
      await git(repo, 'worktree', 'remove', '--force', worktree).catch(() => undefined);
      await rm(parent, { recursive: true, force: true });
    }
  });

  test('should link modules beside the worktrees, so removing one cannot delete them', async () => {
    // The first version linked node_modules inside each worktree. A plain
    // `git worktree remove` followed the link and deleted the checkout's modules.
    const { parent, repo } = await throwawayRepo();
    const worktree = join(runsRoot(repo), 'e2e-coder-2');
    try {
      await createRunWorktree(repo, 'e2e-coder-2', await headCommit(repo));
      expect(
        existsSync(join(worktree, 'node_modules')),
        'nothing may be linked inside a worktree, where removal would follow it',
      ).toBe(false);
      expect(
        existsSync(join(runsRoot(repo), 'node_modules', 'pkg', 'index.js')),
        'the worktree resolves modules by walking up to the runs folder',
      ).toBe(true);

      await git(repo, 'worktree', 'remove', worktree);
      expect(existsSync(worktree), 'the worktree itself is gone').toBe(false);
      expect(
        existsSync(join(repo, 'node_modules', 'pkg', 'index.js')),
        'removing a run worktree deleted the checkout’s node_modules',
      ).toBe(true);
    } finally {
      await git(repo, 'worktree', 'remove', '--force', worktree).catch(() => undefined);
      await rm(parent, { recursive: true, force: true });
    }
  });

  test('should know what the base commit holds and whether modules match it', async () => {
    const { parent, repo } = await throwawayRepo();
    try {
      const base = await headCommit(repo);
      expect(await committedAt(repo, base, DESIGN)).toBe(true);
      writeFileSync(join(repo, 'apps', 'todo-fixture', 'designs', 'draft.md'), 'uncommitted');
      expect(
        await committedAt(repo, base, 'apps/todo-fixture/designs/draft.md'),
        'an uncommitted design never reaches a worktree checked out at the base',
      ).toBe(false);

      expect(await lockfileProblem(repo, base)).toBeNull();
      writeFileSync(join(repo, 'package-lock.json'), '{\n  "lockfileVersion": 4\n}\n');
      expect(
        await lockfileProblem(repo, base),
        'linked modules installed from a different lockfile cannot be trusted',
      ).toContain('differs from the base commit');
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  test('should refuse a path that is not one of its run worktrees', async () => {
    const { parent, repo } = await throwawayRepo();
    try {
      expect(
        await isRunWorktree(repo, join(parent, 'elsewhere')),
        'an investigator must only be pointed at a real run worktree',
      ).toBe(false);
      expect(await freePort()).toBeGreaterThan(0);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
