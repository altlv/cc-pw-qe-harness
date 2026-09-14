import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * Where the command-line tools the harness spawns actually live.
 *
 * Resolved the way an import is — by walking up from this module through parent
 * folders — never from the working directory. Paths built as
 * `resolve('node_modules/…')` worked only while a command ran from the repository root.
 * Every path here was
 * checked to resolve from the checkout on 2026-09-14.
 */

const require = createRequire(import.meta.url);

export const TSX_CLI = require.resolve('tsx/cli');

export const PLAYWRIGHT_CLI = require.resolve('@playwright/test/cli');

/** `@playwright/mcp` exports only its package.json, so its CLI is found beside it. */
export const PLAYWRIGHT_MCP_DIR = dirname(require.resolve('@playwright/mcp/package.json'));

export const PLAYWRIGHT_MCP_CLI = join(PLAYWRIGHT_MCP_DIR, 'cli.js');
