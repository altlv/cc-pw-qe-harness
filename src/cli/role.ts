import '../env.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AgentAuthError, runAgent } from '../agents/client.js';
import { Budget, DEFAULT_LIMITS } from '../agents/budget.js';
import { budgetForTier, resolveModel } from '../agents/models.js';
import { roles } from '../agents/roles.js';

/**
 * Runs one named role against a task.
 *
 * Until this existed, src/agents/roles.ts was seven definitions with no way to
 * execute them — the roles and the harness were separate halves. This is the seam
 * that makes a role something you can run and therefore something you can check.
 */

const [, , name, ...rest] = process.argv;
const outFlag = rest.indexOf('--out');
const outPath = outFlag === -1 ? null : rest[outFlag + 1];
const task = (outFlag === -1 ? rest : rest.slice(0, outFlag)).join(' ').trim();

if (name === undefined || task === '') {
  console.error('usage: npm run role -- <role> "<task>" [--out <path>]');
  console.error(`  roles: ${Object.keys(roles).join(', ')}`);
  process.exit(2);
}

const role = roles[name];
if (role === undefined) {
  console.error(`Unknown role "${name}". Available: ${Object.keys(roles).join(', ')}`);
  process.exit(2);
}

// A role declares how many turns its work takes, written for sonnet; the tier scales
// that and the spend. An operator setting AGENT_MAX_TURNS or AGENT_MAX_USD is asking
// deliberately and still wins — but `.env.example` no longer ships either, because a
// copied example is not a deliberate ask, and the one it shipped cut every role to 12.
const chosen = resolveModel();
if (chosen.warning !== null) console.error(`WARNING: ${chosen.warning}`);

// Optional on the SDK type; tests/unit/roles.test.ts requires every role here to
// set it, so the fallback is for the type checker rather than for a real role.
const declaredTurns = role.maxTurns ?? DEFAULT_LIMITS.maxTurns;
const scaled = budgetForTier(chosen.tier, declaredTurns, DEFAULT_LIMITS.maxUsd);
const envTurns = process.env.AGENT_MAX_TURNS?.trim();
const envUsd = process.env.AGENT_MAX_USD?.trim();
const budget = Budget.fromEnv({
  ...(envTurns === undefined || envTurns === '' ? { maxTurns: scaled.maxTurns } : {}),
  ...(envUsd === undefined || envUsd === '' ? { maxUsd: scaled.maxUsd } : {}),
});
console.error(
  `Running ${name} on ${chosen.id} (${chosen.tier}) — max ${budget.limits.maxTurns} turns, ` +
    `$${budget.limits.maxUsd.toFixed(2)}, ${budget.limits.timeoutMs / 1000}s` +
    (budget.limits.maxTurns === scaled.maxTurns
      ? ` (role asks ${declaredTurns} × ${chosen.tier})`
      : ` (AGENT_MAX_TURNS overrides the role's ${declaredTurns})`),
);

let result;
try {
  result = await runAgent({
    prompt: task,
    systemPrompt: role.prompt,
    allowedTools: role.tools,
    // Every role, so a coder handed no design can call test-planner. Only roles that
    // hold the `Agent` tool can reach these, which the coding family does and the
    // testing family does not — enforced in tests/unit/roles.test.ts. `runAgent` has
    // taken an `agents` option since it was written and nothing ever passed one, so
    // delegation was wired and dead.
    agents: roles,
    model: chosen.id,
    budget,
    cwd: process.cwd(),
  });
} catch (error) {
  if (error instanceof AgentAuthError) {
    console.error(error.message);
    process.exit(2);
  }
  throw error;
}

const spent = budget.spent();
console.error(
  `\n${name}: ${spent.turns} turns, $${spent.costUsd.toFixed(4)}, ` +
    `${Math.round(spent.elapsedMs / 1000)}s` +
    (result.stoppedBy === null ? '' : ` — STOPPED: ${result.stoppedBy}`),
);

if (result.stoppedBy !== null) {
  // A truncated run is not a result. Say so loudly rather than letting a partial
  // answer read like a finished one.
  console.error('The run hit a budget limit. Treat the output below as partial.');
}

if (outPath !== undefined && outPath !== null) {
  const target = resolve(outPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, result.text, 'utf8');
  console.error(`Report written to ${target}`);
  console.error(`Verify it: npm run check-report -- ${outPath}`);
} else {
  console.log(result.text);
}

process.exit(result.stoppedBy === null ? 0 : 1);
