import { test, expect } from '@playwright/test';
import { targetFor } from '../../apps/targets.js';

/**
 * A server the harness starts gets a port per run. The base URL must follow it — a
 * server on one port and specs pointed at another is the split target all over again.
 */

test.describe('a run’s port for a harness-started server', () => {
  test('should move the base URL and the server to the port the run was given', () => {
    const before = process.env.FIXTURE_PORT;
    process.env.FIXTURE_PORT = '51234';
    try {
      const target = targetFor('todo-fixture', 'local');
      expect(
        target?.baseURL,
        'the specs and the browser must look where the server actually listens',
      ).toBe('http://127.0.0.1:51234');
      expect(target?.webServer?.port).toBe(51234);
    } finally {
      if (before === undefined) delete process.env.FIXTURE_PORT;
      else process.env.FIXTURE_PORT = before;
    }
  });

  test('should keep the configured port when no run port is set, or it is not a port', () => {
    const before = process.env.FIXTURE_PORT;
    try {
      delete process.env.FIXTURE_PORT;
      expect(targetFor('todo-fixture', 'local')?.baseURL).toBe('http://127.0.0.1:4173');
      process.env.FIXTURE_PORT = 'not-a-port';
      expect(
        targetFor('todo-fixture', 'local')?.baseURL,
        'a garbage value must not become a URL nothing listens on',
      ).toBe('http://127.0.0.1:4173');
    } finally {
      if (before === undefined) delete process.env.FIXTURE_PORT;
      else process.env.FIXTURE_PORT = before;
    }
  });
});
