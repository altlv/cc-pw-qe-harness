import { test, expect } from '@playwright/test';
import { lockPathFor } from '../../src/qe/run-lock.js';

/**
 * With a worktree per run, files no longer collide. The one thing still shared is the
 * deployment, so the lock is per target — and two targets must never share one, or
 * isolated runs queue behind each other for nothing.
 */

test.describe('the lock a run takes', () => {
  test('should be one per app and environment', () => {
    expect(
      lockPathFor('shop', 'test'),
      'runs against different targets must be able to proceed side by side',
    ).not.toBe(lockPathFor('shop', 'prod'));
    expect(lockPathFor('shop', 'test')).not.toBe(lockPathFor('todo-fixture', 'test'));
    expect(lockPathFor('shop', 'test')).toBe(lockPathFor('shop', 'test'));
  });
});
