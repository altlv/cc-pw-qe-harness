import '../env.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AgentAuthError, runAgent } from '../agents/client.js';
import { Budget } from '../agents/budget.js';
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

// The role declares a sensible default; an operator setting AGENT_MAX_TURNS is
// asking deliberately, so that wins. The chosen limit is printed either way, because
// a budget that silently differs from the one you set is worse than no budget.
const envTurns = process.env.AGENT_MAX_TURNS?.trim();
const budget = Budget.fromEnv(
  envTurns === undefined || envTurns === '' ? { maxTurns: role.maxTurns } : {},
);
console.error(
  `Running ${name} — max ${budget.limits.maxTurns} turns, ` +
    `$${budget.limits.maxUsd.toFixed(2)}, ${budget.limits.timeoutMs / 1000}s`,
);

let result;
try {
  result = await runAgent({
    prompt: task,
    systemPrompt: role.prompt,
    allowedTools: role.tools,
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
