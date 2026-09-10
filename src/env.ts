/**
 * Loads .env into process.env.
 *
 * `.env.example` documents ANTHROPIC_API_KEY, HARNESS_MODEL, BASE_URL and the agent
 * budget limits, and the code reads them from process.env — but nothing was ever
 * loading the file. Anyone following the README set their key and watched it be
 * ignored, which is a particularly annoying failure because the code looks correct
 * from both ends.
 *
 * Uses Node's built-in loader rather than a dependency. Import for side effect,
 * first thing, before anything reads process.env.
 */
try {
  // Available from Node 20.12 / 21.7. Absent .env is fine — CI supplies real
  // environment variables instead.
  process.loadEnvFile('.env');
} catch {
  // No .env, or a Node old enough to lack the loader. Either way, fall back to
  // whatever the environment already provides.
}

export {};
