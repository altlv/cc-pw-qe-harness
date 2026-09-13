import '../env.js';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AgentAuthError, runAgent } from '../agents/client.js';
import type { AgentRunOptions } from '../agents/client.js';
import { Budget, DEFAULT_LIMITS } from '../agents/budget.js';
import { budgetForTier, resolveModel } from '../agents/models.js';
import { BROWSER_ACCESS, roles } from '../agents/roles.js';
import { BROWSER_MCP_SERVER, browserMcpConfig, browserToolsFor } from '../qe/browser-tools.js';
import type { SnapshotMode } from '../qe/browser-tools.js';
import { browserGuard } from '../qe/browser-guard.js';
import { sessionBriefing } from '../qe/session-briefing.js';
import type { BrowserGuard } from '../qe/browser-guard.js';
import { ENVIRONMENTS, isEnvironment, policyFor } from '../qe/exploration-policy.js';
import { NetworkRecorder } from '../capture/network.js';
import { formatProbe, probePage } from '../tools/probe.js';

/**
 * Runs one named role against a task.
 *
 * Until this existed, src/agents/roles.ts was seven definitions with no way to
 * execute them — the roles and the harness were separate halves. This is the seam
 * that makes a role something you can run and therefore something you can check.
 */

const [, , name, ...rest] = process.argv;

function flag(named: string): string | undefined {
  const at = rest.indexOf(named);
  return at === -1 ? undefined : rest[at + 1];
}

const outPath = flag('--out') ?? null;
const envArg = flag('--env');
const target = flag('--target');
// Every tool response carries a full accessibility tree by default, which is the
// single largest cost in a browser session on a real page. `none` keeps the explicit
// browser_snapshot tool and stops paying for a tree nobody asked for.
const snapshots: SnapshotMode = flag('--snapshots') === 'none' ? 'none' : 'full';
// Hand the agent the map instead of making it buy one. Measured: asking a browser
// for an accessibility tree cost $0.23 on a real page, and the scanner produces a
// better answer — graded selectors, ambiguity, unlabelled inputs — for no tokens.
const prescan = rest.includes('--scan');

/** Everything before the first flag. */
const firstFlag = rest.findIndex((argument) => argument.startsWith('--'));
const task = (firstFlag === -1 ? rest : rest.slice(0, firstFlag)).join(' ').trim();

if (name === undefined || task === '') {
  console.error('usage: npm run role -- <role> "<task>" [--out <path>] [--env <e> --target <url>]');
  console.error(`  roles: ${Object.keys(roles).join(', ')}`);
  console.error(`  --env  ${ENVIRONMENTS.join(' | ')} — required for a role that drives a browser`);
  process.exit(2);
}

const role = roles[name];
if (role === undefined) {
  console.error(`Unknown role "${name}". Available: ${Object.keys(roles).join(', ')}`);
  process.exit(2);
}

/**
 * A browser, if this role is one that looks at running software — and only under a
 * declared policy.
 *
 * `exploration-policy.ts` insists there is no default environment, because a wrong
 * guess is the expensive kind. So a role that can drive a browser refuses to start
 * without one rather than assuming `local`. What the policy permits becomes the tool
 * allowlist and the browser's own origin restriction; neither is a promise the model
 * makes.
 */
let browser: {
  mcpServers: NonNullable<AgentRunOptions['mcpServers']>;
  tools: string[];
  briefing: string;
  guard: BrowserGuard;
} | null = null;

const access = BROWSER_ACCESS[name];
if (access !== undefined) {
  if (!isEnvironment(envArg) || target === undefined) {
    console.error(
      `"${name}" drives a browser, so it needs --env <${ENVIRONMENTS.join('|')}> --target <url>.\n` +
        'There is no default environment: deleting a record on a local fixture is a test,\n' +
        'and the same click on production is an incident.',
    );
    process.exit(2);
  }
  const policy = policyFor(envArg);

  let map = '';
  if (prescan) {
    process.stderr.write(`Scanning ${target} before the session… `);
    const chrome = await chromium.launch();
    const page = await chrome.newPage();
    const network = NetworkRecorder.attach(page, { captureBodies: policy.captureBodies });
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
      map = formatProbe(await probePage(page, network, {}));
      process.stderr.write(`${map.split('\n').length} lines, 0 tokens spent\n`);
    } finally {
      await chrome.close();
    }
  }

  browser = {
    mcpServers: {
      [BROWSER_MCP_SERVER]: browserMcpConfig(policy, target, 'artifacts/browser', snapshots),
    },
    tools: browserToolsFor(policy, access),
    briefing: sessionBriefing({ target, policy, access, map }),
    guard: browserGuard(policy),
  };
  console.error(
    `Browser: ${envArg} policy at ${target} — ${browser.tools.length} of the ` +
      `MCP server’s tools granted (role ceiling: ${access}, snapshots: ${snapshots})` +
      (policy.allowWrites && access === 'full' ? '' : ', read-only'),
  );
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
    prompt:
      browser === null
        ? task
        : `${browser.briefing}

${task}`,
    systemPrompt: role.prompt,
    allowedTools: [...(role.tools ?? []), ...(browser?.tools ?? [])],
    ...(browser === null ? {} : { mcpServers: browser.mcpServers }),
    // Every role, so a coder handed no design can call test-planner. Only roles that
    // hold the `Agent` tool can reach these, which the coding family does and the
    // testing family does not — enforced in tests/unit/roles.test.ts. `runAgent` has
    // taken an `agents` option since it was written and nothing ever passed one, so
    // delegation was wired and dead.
    agents: roles,
    // The half an allowlist cannot express: which target, and how many times.
    // Fail-closed by the SDK's own contract, so a thrown guard denies rather than
    // permits.
    ...(browser === null
      ? {}
      : {
          canUseTool: (toolName: string, input: Record<string, unknown>) => {
            const verdict = browser.guard.check(toolName, input);
            if (!verdict.allowed) console.error(`  refused ${toolName}: ${verdict.reason}`);
            return Promise.resolve(
              verdict.allowed
                ? ({ behavior: 'allow', updatedInput: input } as const)
                : ({ behavior: 'deny', message: verdict.reason } as const),
            );
          },
        }),
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
