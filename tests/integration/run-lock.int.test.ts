import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, releaseLock, type LockRecord } from '../../src/qe/run-lock.js';

/**
 * The lock is a file on disk and a race between processes, so it is tested against a
 * real file in a throwaway directory — never the repository's own lock.
 */

const run = (pid: number): LockRecord => ({
  pid,
  role: 'e2e-coder',
  startedAt: '2026-09-14T10:00:00Z',
});

test.describe('the run lock on disk', () => {
  test('should let one run hold it, refuse a second, and release for the next', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'harness-lock-'));
    const path = join(dir, 'run.lock');
    try {
      expect(acquireLock(run(111), path, () => true).take).toBe(true);
      expect(
        acquireLock(run(222), path, () => true),
        'a second run must be refused while the first holds the lock',
      ).toEqual({ take: false, heldBy: run(111) });

      releaseLock(222, path);
      expect(existsSync(path), 'a run must not release a lock it does not hold').toBe(true);

      releaseLock(111, path);
      expect(acquireLock(run(222), path, () => true).take).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('should take over a lock left by a dead run', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'harness-lock-'));
    const path = join(dir, 'run.lock');
    try {
      acquireLock(run(111), path, () => true);
      const decision = acquireLock(run(333), path, () => false);
      expect(
        decision,
        'a crashed run’s lock must be replaced, and the replacement said out loud',
      ).toEqual({ take: true, replacedStale: run(111) });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
