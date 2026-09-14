import '../env.js';
import { chromium } from '@playwright/test';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { apps } from '../../apps/registry.js';
import { targetFor } from '../../apps/targets.js';
import { AgentAuthError, runAgent } from '../agents/client.js';
import type { AgentRunOptions } from '../agents/client.js';
import { Budget, DEFAULT_LIMITS } from '../agents/budget.js';
import { composeRoles, composeSystemPrompt } from '../agents/compose.js';
import { budgetForTier, resolveModel } from '../agents/models.js';
import { BROWSER_ACCESS, WALL_CLOCK_SECONDS, families, roles } from '../agents/roles.js';
import { BROWSER_MCP_SERVER, browserMcpConfig, browserToolsFor } from '../qe/browser-tools.js';
import type { SnapshotMode } from '../qe/browser-tools.js';
import { browserGuard } from '../qe/browser-guard.js';
import type { BrowserGuard, GuardDecision } from '../qe/browser-guard.js';
import { sessionBriefing } from '../qe/session-briefing.js';
import { ENVIRONMENTS, policyFor } from '../qe/exploration-policy.js';
import { fileToolGuard } from '../qe/file-guard.js';
import { readinessProblems, stalenessWarning } from '../qe/readiness.js';
import { parseReport } from '../qe/report.js';
import { gatePassed, investigationCommand, planGate, type GateRecord } from '../qe/run-gate.js';
import { acquireLock, lockPathFor, releaseLock } from '../qe/run-lock.js';
import { resolveRunTarget } from '../qe/run-target.js';
import {
  committedAt,
  createRunWorktree,
  freePort,
  headCommit,
  isRunWorktree,
  lockfileProblem,
  worktreeChanges,
} from '../qe/run-worktree.js';
import { shellGuard } from '../qe/shell-guard.js';
import { guardHook } from '../qe/tool-hook.js';
import { NetworkRecorder } from '../capture/network.js';
import { formatProbe, probePage } from '../tools/probe.js';

/**
 * Runs one named role against a task, as `docs/agent-workflows.md` specifies.
 *
 * The run works in its own git worktree at a named base commit: refused if it is not
 * ready, one run per target at a time, every tool call guarded and confined to the
 * worktree, a post-run gate on the worktree's diff, and a failure handed to a person to
 * investigate rather than overridden or retried. The work comes back uncommitted, in the
 * worktree, for a person to review and bring in.
 *
 * A command-line entry point, and like `src/cli/targets.ts` it reads the app registry.
 * The decisions it makes live in `src/qe/`, which does not.
 */

const exec = promisify(execFile);
const repoRoot = process.cwd();
const [, , name, ...rest] = process.argv;

function flag(named: string): string | undefined {
  const at = rest.indexOf(named);
  return at === -1 ? undefined : rest[at + 1];
}

function refuse(reason: string, detail: string[] = []): never {
  console.error(reason);
  for (const line of detail) console.error(`  ✗ ${line}`);
  process.exit(2);
}

const outPath = flag('--out');
const appArg = flag('--app');
const envArg = flag('--env');
const designPath = flag('--design');
const reusePath = flag('--worktree');
// Every tool response carries a full accessibility tree by default, which is the
// single largest cost in a browser session on a real page. `none` keeps the explicit
// browser_snapshot tool and stops paying for a tree nobody asked for.
const snapshots: SnapshotMode = flag('--snapshots') === 'none' ? 'none' : 'full';
// Hand the agent the map instead of making it buy one: the scanner produces graded
// selectors, ambiguity and unlabelled inputs for no tokens.
const prescan = rest.includes('--scan');
// Every check that can refuse a run, and nothing that costs anything: no worktree, no
// browser, no agent. Also what the refusal tests use, so a check that fails to refuse
// ends in exit 0 instead of a paid run.
const preflight = rest.includes('--preflight');

/** Everything before the first flag. */
const firstFlag = rest.findIndex((argument) => argument.startsWith('--'));
const task = (firstFlag === -1 ? rest : rest.slice(0, firstFlag)).join(' ').trim();

if (name === undefined || task === '') {
  console.error(
    'usage: npm run role -- <role> "<task>" [--app <app> --env <env>] [--design <path>] [--worktree <path>] [--out <path>] [--scan] [--preflight]',
  );
  console.error(`  roles: ${Object.keys(roles).join(', ')}`);
  console.error(`  apps:  ${apps.map((app) => app.name).join(', ')}`);
  console.error(`  --env  ${ENVIRONMENTS.join(' | ')} — there is no default`);
  process.exit(2);
}

const role = roles[name];
const family = families[name];
if (role === undefined || family === undefined) {
  refuse(`Unknown role "${name}". Available: ${Object.keys(roles).join(', ')}`);
}

// ── Ports for servers the harness starts, before any target resolves ─────────────
// The target's base URL follows the port, so the server, the browser and the specs all
// agree — and no run can meet a server another run left behind. A port already set in
// the environment is a deliberate choice and stands.
for (const app of apps) {
  for (const config of Object.values(app.environments)) {
    const portEnv = config?.webServer?.portEnv;
    if (portEnv !== undefined && process.env[portEnv] === undefined) {
      process.env[portEnv] = String(await freePort());
    }
  }
}

// ── Ready? ────────────────────────────────────────────────────────────────────────

if (reusePath !== undefined) {
  if (family !== 'testing') {
    refuse(
      `Only a testing role may run in another run's worktree — "${name}" can edit, and would change the evidence.`,
    );
  }
  if (!(await isRunWorktree(repoRoot, reusePath))) {
    refuse(`--worktree ${reusePath} is not one of this repository's run worktrees.`);
  }
}
const workRoot = reusePath === undefined ? repoRoot : resolve(reusePath);

const resolved = resolveRunTarget(
  { app: appArg, env: envArg },
  {
    apps: apps.map((app) => app.name),
    lookup: (app, environment) => {
      const target = targetFor(app, environment);
      return target === undefined
        ? undefined
        : { baseURL: target.baseURL, extraHosts: target.app.extraHosts ?? [] };
    },
  },
);
const runTarget = resolved.target;

const notReady = [
  ...resolved.problems,
  ...readinessProblems(
    { role: name, task, app: appArg, environment: envArg, design: designPath },
    {
      exists: (path) => existsSync(resolve(workRoot, path)),
      readDesign: (path) => {
        const parsed = parseReport(readFileSync(resolve(workRoot, path), 'utf8'));
        return parsed.ok
          ? { kind: parsed.report.report, cases: parsed.report.cases.length }
          : { problems: parsed.problems.map((problem) => problem.message) };
      },
    },
  ),
];

const base = reusePath === undefined ? await headCommit(repoRoot) : await headCommit(workRoot);
if (reusePath === undefined) {
  // A worktree is checked out at the base commit: anything uncommitted never reaches it.
  if (designPath !== undefined && !(await committedAt(repoRoot, base, designPath))) {
    notReady.push(
      `design ${designPath} is not committed — the run works at ${base.slice(0, 7)}, and an uncommitted file never reaches it`,
    );
  }
  const lockfile = await lockfileProblem(repoRoot, base);
  if (lockfile !== null) notReady.push(lockfile);
}
if (notReady.length > 0) refuse(`"${name}" is not ready to start — missing upstream:`, notReady);

// A design can outlive the code it describes. Warned, not refused.
if (designPath !== undefined && runTarget !== null && existsSync(resolve(workRoot, designPath))) {
  const parsed = parseReport(readFileSync(resolve(workRoot, designPath), 'utf8'));
  const commit = parsed.ok ? parsed.report.commit : undefined;
  let changedSince: string[] | null = null;
  if (commit !== undefined) {
    try {
      const { stdout } = await exec(
        'git',
        ['-C', repoRoot, 'diff', '--name-only', commit, base, '--', `apps/${runTarget.app}`],
        { windowsHide: true },
      );
      changedSince = stdout.split(/\r?\n/).filter((line) => line.trim() !== '');
    } catch {
      changedSince = null;
    }
  }
  const warning = stalenessWarning(designPath, commit, changedSince);
  if (warning !== null) console.error(`WARNING: ${warning}`);
}

// ── One run per target ────────────────────────────────────────────────────────────

if (runTarget !== null) {
  const lockPath = join(repoRoot, lockPathFor(runTarget.app, runTarget.environment));
  const lock = acquireLock(
    { pid: process.pid, role: name, startedAt: new Date().toISOString() },
    lockPath,
  );
  if (!lock.take) {
    refuse(
      `${runTarget.app}/${runTarget.environment} is in use by ${lock.heldBy.role} (pid ${lock.heldBy.pid}, since ${lock.heldBy.startedAt}). ` +
        'Two runs writing to one deployment meet each other’s data. Wait, or point at another target.',
    );
  }
  if (lock.replacedStale !== null) {
    console.error(
      `Replaced a lock left by a run that is no longer alive: ${lock.replacedStale.role} (pid ${lock.replacedStale.pid}).`,
    );
  }
  process.on('exit', () => releaseLock(process.pid, lockPath));
  process.on('SIGINT', () => process.exit(130));
}

if (preflight) {
  console.error(
    `Preflight: "${name}" is ready` +
      (runTarget === null ? '' : ` against ${runTarget.app}/${runTarget.environment}`) +
      ` at ${base.slice(0, 7)}. Stopped before the worktree and the agent.`,
  );
  process.exit(0);
}

// ── The worktree ──────────────────────────────────────────────────────────────────

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const worktree =
  reusePath === undefined
    ? await createRunWorktree(repoRoot, `${name}-${stamp}`, base)
    : resolve(reusePath);
console.error(
  `${reusePath === undefined ? 'Created' : 'Reusing'} worktree ${worktree} at ${base.slice(0, 7)}`,
);

// ── The browser, when the role looks at running software and has somewhere to look ─

let browser: {
  mcpServers: NonNullable<AgentRunOptions['mcpServers']>;
  tools: string[];
  briefing: string;
  guard: BrowserGuard;
} | null = null;

const access = BROWSER_ACCESS[name];
if (access !== undefined && runTarget !== null) {
  const policy = policyFor(runTarget.environment);

  let map = '';
  if (prescan) {
    process.stderr.write(`Scanning ${runTarget.baseURL} before the session… `);
    const chrome = await chromium.launch();
    const page = await chrome.newPage();
    const network = NetworkRecorder.attach(page, { captureBodies: policy.captureBodies });
    try {
      await page.goto(runTarget.baseURL, { waitUntil: 'domcontentloaded' });
      map = formatProbe(await probePage(page, network, {}));
      process.stderr.write(`${map.split('\n').length} lines, 0 tokens spent\n`);
    } finally {
      await chrome.close();
    }
  }

  browser = {
    mcpServers: {
      [BROWSER_MCP_SERVER]: browserMcpConfig(
        policy,
        runTarget.origins,
        join(worktree, 'artifacts', 'browser'),
        snapshots,
      ),
    },
    tools: browserToolsFor(policy, access),
    briefing: sessionBriefing({ target: runTarget.baseURL, policy, access, map }),
    guard: browserGuard(policy),
  };
  console.error(
    `Browser: ${runTarget.app}/${runTarget.environment} at ${runTarget.baseURL} — ${browser.tools.length} of the ` +
      `MCP server’s tools granted (role ceiling: ${access}, snapshots: ${snapshots})` +
      (policy.allowWrites && access === 'full' ? '' : ', read-only'),
  );
} else if (access !== undefined) {
  console.error(`No --app/--env given, so ${name} runs without a browser.`);
}

// A role declares how many turns and how much wall clock its work takes, written for
// sonnet; the tier scales turns and spend. An operator setting AGENT_MAX_TURNS,
// AGENT_MAX_USD or AGENT_TIMEOUT_MS is asking deliberately and still wins.
const chosen = resolveModel();
if (chosen.warning !== null) console.error(`WARNING: ${chosen.warning}`);

const declaredTurns = role.maxTurns ?? DEFAULT_LIMITS.maxTurns;
const scaled = budgetForTier(
  chosen.tier,
  declaredTurns,
  DEFAULT_LIMITS.maxUsd,
  WALL_CLOCK_SECONDS[name] ?? DEFAULT_LIMITS.timeoutMs / 1000,
);
const override = (variable: string): boolean => (process.env[variable]?.trim() ?? '') !== '';
const budget = Budget.fromEnv({
  ...(override('AGENT_MAX_TURNS') ? {} : { maxTurns: scaled.maxTurns }),
  ...(override('AGENT_MAX_USD') ? {} : { maxUsd: scaled.maxUsd }),
  ...(override('AGENT_TIMEOUT_MS') ? {} : { timeoutMs: scaled.timeoutMs }),
});
console.error(
  `Running ${name} on ${chosen.id} (${chosen.tier}) — max ${budget.limits.maxTurns} turns, ` +
    `$${budget.limits.maxUsd.toFixed(2)}, ${budget.limits.timeoutMs / 1000}s` +
    (budget.limits.maxTurns === scaled.maxTurns
      ? ` (role asks ${declaredTurns} × ${chosen.tier})`
      : ` (AGENT_MAX_TURNS overrides the role's ${declaredTurns})`),
);

// ── The guarded agent loop, inside the worktree ───────────────────────────────────

const targetLine =
  runTarget === null
    ? ''
    : `# Where this run points\n\n${runTarget.app} in ${runTarget.environment}, at ${runTarget.baseURL}. Run specs with TEST_ENV=${runTarget.environment}.\n\n`;
const design =
  designPath === undefined
    ? ''
    : `# Design for this run\n\n_From ${designPath}. Implement its cases by id and cite the ids in your report._\n\n${readFileSync(resolve(workRoot, designPath), 'utf8')}\n\n`;
const prompt = `${browser === null ? '' : `${browser.briefing}\n\n`}# Where you work\n\nYour working directory is a git worktree of this repository at ${base.slice(0, 7)}. Every file you read or write stays inside it.\n\n${targetLine}${design}${task}`;

const shell = shellGuard({
  environment: runTarget?.environment ?? null,
  hosts: runTarget?.hosts ?? [],
});
const files = fileToolGuard(worktree);
const allow: GuardDecision = { allowed: true, reason: 'no guard applies' };
const check = (toolName: string, input: Record<string, unknown>): GuardDecision => {
  if (toolName === 'Bash') {
    return shell.check(typeof input.command === 'string' ? input.command : '');
  }
  const fileDecision = files.check(toolName, input);
  if (fileDecision !== null) return fileDecision;
  return browser === null ? allow : browser.guard.check(toolName, input);
};

let result;
try {
  result = await runAgent({
    prompt,
    systemPrompt: composeSystemPrompt(role),
    allowedTools: [...(role.tools ?? []), ...(browser?.tools ?? [])],
    ...(browser === null ? {} : { mcpServers: browser.mcpServers }),
    // Every role, composed the same way, so a coder that finds a gap mid-run can call
    // test-planner and the planner arrives with its skills. Only roles holding the
    // `Agent` tool can reach these — enforced in tests/unit/roles.test.ts.
    agents: composeRoles(roles),
    hooks: {
      PreToolUse: [
        guardHook(check, (toolName, reason) => console.error(`  refused ${toolName}: ${reason}`)),
      ],
    },
    model: chosen.id,
    budget,
    cwd: worktree,
  });
} catch (error) {
  if (error instanceof AgentAuthError) refuse(error.message);
  throw error;
}

const spent = budget.spent();
console.error(
  `\n${name}: ${spent.turns} turns, $${spent.costUsd.toFixed(4)}, ` +
    `${Math.round(spent.elapsedMs / 1000)}s` +
    (result.stoppedBy === null ? '' : ` — STOPPED: ${result.stoppedBy}`),
);
if (result.stoppedBy !== null) {
  console.error('The run hit a budget limit. Its report is partial; the gate still runs.');
}

// ── Post-run gate on the worktree's diff ──────────────────────────────────────────

// The report is always written, so the gate has something to check and a person has
// something to read. An investigation in a reused worktree writes beside the run's own.
const runDir = reusePath === undefined ? 'artifacts/run' : `artifacts/investigation-${stamp}`;
const reportPath =
  outPath === undefined ? join(worktree, runDir, 'report.md') : resolve(repoRoot, outPath);
await mkdir(join(worktree, runDir), { recursive: true });
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, result.text, 'utf8');
console.error(`Report written to ${reportPath}`);

// Everything changed in the worktree is the run's: nobody else works there.
const changed = await worktreeChanges(worktree);
const plan = planGate({
  role: name,
  family,
  changed,
  report: reportPath,
  environment: runTarget?.environment ?? null,
  runDir,
});

console.error(`\nPost-run gate — ${changed.length} file(s) changed in the worktree:`);
for (const path of changed) console.error(`    ${path}`);

const record: GateRecord = {
  role: name,
  app: runTarget?.app ?? null,
  environment: runTarget?.environment ?? null,
  report: reportPath,
  changed,
  steps: [],
  problems: plan.problems,
  notRun: plan.notRun,
  evidence: [
    reportPath,
    `${runDir}/results.json`,
    `${runDir}/test-results`,
    'artifacts/results-fault.json',
    'artifacts/fault-check/test-results',
  ],
};

for (const problem of plan.problems) console.error(`  ✗ ${problem}`);
for (const step of plan.steps) {
  try {
    await exec(process.execPath, step.args, {
      cwd: worktree,
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, ...step.env },
    });
    record.steps.push({ name: step.name, passed: true, output: [] });
    console.error(`  ✓ ${step.name}`);
  } catch (error) {
    const output = error as { stdout?: string; stderr?: string };
    const tail = `${output.stdout ?? ''}${output.stderr ?? ''}`.trim().split('\n').slice(-30);
    record.steps.push({ name: step.name, passed: false, output: tail });
    console.error(`  ✗ ${step.name}`);
    for (const line of tail.slice(-15)) console.error(`      ${line}`);
  }
}
for (const skipped of plan.notRun) console.error(`  · not run: ${skipped}`);

const recordPath = `${runDir}/gate.json`;
await writeFile(join(worktree, recordPath), JSON.stringify(record, null, 2), 'utf8');

const passed = gatePassed(record) && result.stoppedBy === null;
if (passed) {
  console.error(
    `\nGate: PASS — the run's work is uncommitted in ${worktree}. Nothing has been committed or merged.\n` +
      `  Review it:   git -C "${worktree}" status  and  git -C "${worktree}" diff\n` +
      `  Bring it in yourself when it is right. git refuses a plain \`git worktree remove\` while that work is\n` +
      `  still there, which protects it; once it is in, discard the rest: git worktree remove --force "${worktree}"`,
  );
} else {
  console.error(
    `\nGate: FAIL — stopped, recorded in ${join(worktree, recordPath)}. Nothing retries, nothing is overridden, and the worktree is kept as evidence.`,
  );
  const next = investigationCommand(record, recordPath, worktree);
  if (next !== null) {
    console.error(
      'A failure is a finding. Prove its cause before anything runs again — you start it:',
    );
    console.error(`  ${next}`);
  }
}
process.exit(passed ? 0 : 1);
