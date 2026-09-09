import type { AppConfig } from './app-config.js';
import countdownTimer from './countdown-timer/app.config.js';
import todoFixture from './todo-fixture/app.config.js';

/**
 * Every app under test, one folder each under apps/.
 *
 * To add an app: create apps/<name>/ with an app.config.ts and a tests/ folder,
 * then add it here. Nothing else needs editing — playwright.config.ts builds a
 * project, a web server and a test directory from this list.
 */
export const apps: AppConfig[] = [todoFixture, countdownTimer];
