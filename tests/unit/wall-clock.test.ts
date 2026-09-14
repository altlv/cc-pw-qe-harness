import { test, expect } from '@playwright/test';
import { WALL_CLOCK_SECONDS, roles } from '../../src/agents/roles.js';

/**
 * Every role used to share one 180-second wall clock, while the coder method asked for
 * a scan, a test run and a mutation run inside it. The runner can only hold a role to a
 * limit the role declares.
 */

test.describe('wall clock per role', () => {
  for (const name of Object.keys(roles)) {
    test(`should give ${name} a declared wall clock longer than the old shared limit`, () => {
      const seconds = WALL_CLOCK_SECONDS[name];
      expect(
        seconds,
        `"${name}" declares no wall clock, so it would fall back to the 180 seconds no coder's method fits in`,
      ).toBeDefined();
      expect(seconds ?? 0).toBeGreaterThan(180);
    });
  }

  test('should declare no wall clock for a role that does not exist', () => {
    const unknown = Object.keys(WALL_CLOCK_SECONDS).filter((name) => !(name in roles));
    expect(unknown, 'a limit for a renamed role silently stops applying').toEqual([]);
  });
});
