/**
 * Rules of engagement for an exploratory session.
 *
 * Exploration means interacting with a running system, and what is safe to do
 * depends entirely on which system it is. Deleting a record on a local fixture
 * is a test; the same click on production is an incident. So the rules are
 * agreed per session rather than hardcoded once.
 *
 * Two things follow from that, and both are deliberate:
 *
 *  1. There is **no default environment**. A session cannot start until someone
 *     declares where it is pointed. A wrong guess here is the expensive kind.
 *  2. The policy is **enforced, not advertised**. An agent that reads a checklist
 *     and promises to behave has made a claim. A bound it cannot exceed is
 *     evidence. This repo prefers evidence.
 */

export type Environment = 'local' | 'test' | 'prod';

export const ENVIRONMENTS: Environment[] = ['local', 'test', 'prod'];

export interface ExplorationPolicy {
  environment: Environment;

  /** May interact in ways that change server state at all. */
  allowWrites: boolean;
  /** May submit forms. The highest-risk ordinary action on a real system. */
  allowFormSubmit: boolean;
  /** May click controls that destroy data. */
  allowDestructive: boolean;
  /** May attempt credentials. Repeated attempts lock real accounts out. */
  allowAuthAttempts: boolean;
  /** May follow links off the starting origin. */
  stayOnOrigin: boolean;

  /**
   * Whether captured request/response bodies are written to disk.
   *
   * This is the setting people forget. The network log is the most valuable
   * artefact the harness produces and, against production, the most dangerous:
   * it is a file of real payloads. Off by default anywhere but local.
   */
  captureBodies: boolean;

  /** Control labels never clicked, whatever else the policy allows. */
  denyLabels: string[];

  /** Rabbit-hole guards. Whichever trips first ends the session. */
  maxStates: number;
  maxActions: number;
  timeoutMs: number;
}

/**
 * Labels that read as irreversible. Matched case-insensitively against a
 * control's accessible name. Deliberately broad: a false skip costs coverage
 * and is reported as unexplored, while a false click can cost data.
 */
const DESTRUCTIVE_LABELS = [
  'delete',
  'remove',
  'destroy',
  'erase',
  'wipe',
  'purge',
  'deactivate',
  'archive',
  'cancel subscription',
  'close account',
  'revoke',
  'reset',
];

/** Labels that reach outside the system entirely. Never clicked, anywhere. */
const OUTBOUND_LABELS = [
  'send',
  'email',
  'invite',
  'publish',
  'post',
  'share',
  'notify',
  'pay',
  'checkout',
  'purchase',
  'order',
  'subscribe',
  'transfer',
];

const PRESETS: Record<Environment, Omit<ExplorationPolicy, 'environment'>> = {
  /** Disposable, resettable, nobody else's data. Explore properly. */
  local: {
    allowWrites: true,
    allowFormSubmit: true,
    allowDestructive: true,
    allowAuthAttempts: true,
    stayOnOrigin: true,
    captureBodies: true,
    denyLabels: [...OUTBOUND_LABELS],
    maxStates: 40,
    maxActions: 200,
    timeoutMs: 300_000,
  },

  /** Shared. Your mess is someone else's blocked afternoon. */
  test: {
    allowWrites: true,
    allowFormSubmit: true,
    allowDestructive: false,
    allowAuthAttempts: false,
    stayOnOrigin: true,
    captureBodies: false,
    denyLabels: [...DESTRUCTIVE_LABELS, ...OUTBOUND_LABELS],
    maxStates: 25,
    maxActions: 100,
    timeoutMs: 180_000,
  },

  /** Real users, real data, real consequences. Look, do not touch. */
  prod: {
    allowWrites: false,
    allowFormSubmit: false,
    allowDestructive: false,
    allowAuthAttempts: false,
    stayOnOrigin: true,
    captureBodies: false,
    denyLabels: [...DESTRUCTIVE_LABELS, ...OUTBOUND_LABELS],
    maxStates: 15,
    maxActions: 40,
    timeoutMs: 120_000,
  },
};

export function policyFor(
  environment: Environment,
  overrides: Partial<ExplorationPolicy> = {},
): ExplorationPolicy {
  return { environment, ...PRESETS[environment], ...overrides };
}

export function isEnvironment(value: string | undefined): value is Environment {
  return value !== undefined && (ENVIRONMENTS as string[]).includes(value);
}

/**
 * Decides whether one control may be interacted with.
 *
 * Returns a reason when the answer is no, because a skipped control has to be
 * reportable. Silent skipping is how a session claims coverage it does not have.
 */
export function actionAllowed(
  policy: ExplorationPolicy,
  control: { label: string | null; tag: string; type: string | null; isSubmit: boolean },
): { allowed: true } | { allowed: false; reason: string } {
  const label = (control.label ?? '').toLowerCase().trim();

  const denied = policy.denyLabels.find((needle) => label.includes(needle));
  if (denied !== undefined) {
    return { allowed: false, reason: `label contains "${denied}"` };
  }

  if (control.isSubmit && !policy.allowFormSubmit) {
    return { allowed: false, reason: `form submission not permitted on ${policy.environment}` };
  }

  const isPassword = control.type === 'password';
  if (isPassword && !policy.allowAuthAttempts) {
    return {
      allowed: false,
      reason: `credential entry not permitted on ${policy.environment} — repeated attempts lock real accounts`,
    };
  }

  if (!policy.allowWrites && (control.isSubmit || control.tag === 'input')) {
    return { allowed: false, reason: `read-only session on ${policy.environment}` };
  }

  return { allowed: true };
}

/**
 * The session-start checklist, rendered from the policy actually in force.
 *
 * Printed before a session begins so the rules are on the record next to the
 * findings, and so a reader can tell a thin session from a constrained one.
 */
export function formatChecklist(policy: ExplorationPolicy, target: string): string {
  const yes = (value: boolean): string => (value ? 'YES' : 'NO ');

  return [
    '=== Exploratory session — rules of engagement ===',
    '',
    `  Target        ${target}`,
    `  Environment   ${policy.environment.toUpperCase()}`,
    '',
    '  Permitted',
    `    ${yes(policy.allowWrites)}  change server state`,
    `    ${yes(policy.allowFormSubmit)}  submit forms`,
    `    ${yes(policy.allowDestructive)}  destructive controls`,
    `    ${yes(policy.allowAuthAttempts)}  credential attempts`,
    `    ${yes(policy.captureBodies)}  write request/response bodies to disk`,
    '',
    '  Definite NOs',
    ...policy.denyLabels.map((label) => `    any control whose label contains "${label}"`),
    '    anything off the starting origin',
    '',
    '  Bounds',
    `    ${policy.maxStates} states · ${policy.maxActions} actions · ${Math.round(policy.timeoutMs / 1000)}s`,
    '',
    '  Every control skipped under these rules is reported as unexplored.',
    '  A clean session under a narrow policy is not evidence of a clean system.',
  ].join('\n');
}
