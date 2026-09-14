import { test, expect } from '@playwright/test';
import { decideLock, processAlive, type LockRecord } from '../../src/qe/run-lock.js';

/**
 * Two runs at once would each count the other's files as their own. The lock must
 * refuse a second run while the first lives, and must not let a dead run block every
 * later one.
 */

const held: LockRecord = { pid: 4242, role: 'e2e-coder', startedAt: '2026-09-14T10:00:00Z' };

test.describe('deciding the run lock', () => {
  test('should take a lock nobody holds', () => {
    expect(decideLock(null, () => true)).toEqual({ take: true, replacedStale: null });
  });

  test('should refuse while the holding run is alive', () => {
    expect(
      decideLock(held, () => true),
      'a second run would attribute the first run’s files to itself',
    ).toEqual({ take: false, heldBy: held });
  });

  test('should replace a lock whose run has died', () => {
    expect(
      decideLock(held, () => false),
      'a crashed run must not block every later run until someone deletes a file',
    ).toEqual({ take: true, replacedStale: held });
  });
});

test.describe('telling whether the holder lives', () => {
  test('should see this process as alive and a nonsense pid as dead', () => {
    expect(processAlive(process.pid)).toBe(true);
    expect(
      [processAlive(-1), processAlive(0), processAlive(Number.NaN)],
      'an unreadable lock must never read as a live holder',
    ).toEqual([false, false, false]);
  });
});
