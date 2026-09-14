/**
 * Which model the harness runs, and what an agent is allowed to spend on it.
 *
 * One place, because it was three: `client.ts` defaulted to a model id, every role
 * pinned `model: 'sonnet'` in a field the runner never read, and `.env.example`
 * shipped an `AGENT_MAX_TURNS` that silently overrode every role's own budget. The
 * roles' declarations were the ones that lost, so `exploratory-tester` asked for 30
 * turns and got 12 — on the role doing the most open-ended work.
 *
 * Roles no longer name a model. They declare how many turns *their work* takes, and
 * the tier decides what that costs and how far it stretches. A subagent with no model
 * of its own inherits the parent's, so a delegated planner cannot end up on a
 * different model from the coder that called it.
 */

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

export const MODEL_IDS: Record<ModelTier, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-5',
  opus: 'claude-opus-5',
};

export const DEFAULT_TIER: ModelTier = 'sonnet';

/**
 * Budget multipliers applied to what a role declares. A role's own `maxTurns` is
 * written for **sonnet**, which is why sonnet is 1.
 *
 * **These are estimates, not measurements.** No role has been run on any tier, so
 * nothing here is tuned — the shape is the claim (a weaker model needs more attempts
 * and costs less per attempt; a stronger one needs fewer and costs more), the
 * numbers are a starting point. Replace them with observed medians once roles have
 * actually run, and delete this paragraph when you do.
 */
export const TIER_BUDGET: Record<ModelTier, { turns: number; usd: number }> = {
  haiku: { turns: 1.5, usd: 0.4 },
  sonnet: { turns: 1, usd: 1 },
  opus: { turns: 0.8, usd: 4 },
};

export interface ResolvedModel {
  /** Passed to the SDK. A tier alias resolves to a pinned id. */
  id: string;
  tier: ModelTier;
  /** Set when HARNESS_MODEL named something we do not recognise. */
  warning: string | null;
}

/**
 * Resolves `HARNESS_MODEL` — a tier alias (`sonnet`) or a full id
 * (`claude-sonnet-5`) — into an id plus the tier whose budget applies.
 *
 * An unrecognised value is passed through rather than refused, so a model released
 * after this file was written still runs. It carries a warning instead: guessing a
 * tier silently would apply the wrong budget to it, and a budget that is wrong
 * without saying so is how a run ends early for no visible reason.
 */
export function resolveModel(raw: string | undefined = process.env.HARNESS_MODEL): ResolvedModel {
  const value = raw?.trim() ?? '';
  if (value === '') {
    return { id: MODEL_IDS[DEFAULT_TIER], tier: DEFAULT_TIER, warning: null };
  }

  for (const tier of Object.keys(MODEL_IDS) as ModelTier[]) {
    if (value === tier) return { id: MODEL_IDS[tier], tier, warning: null };
    if (value.includes(tier)) return { id: value, tier, warning: null };
  }

  return {
    id: value,
    tier: DEFAULT_TIER,
    warning: `HARNESS_MODEL="${value}" matches no known tier (${Object.keys(MODEL_IDS).join(', ')}); running it with ${DEFAULT_TIER} budgets`,
  };
}

/**
 * What a role may spend on this tier.
 *
 * Wall clock is the role's own declaration and is **not** scaled by tier. Most of a
 * run's time is spent in the tools it calls — a scan, a test run, the post-run gate —
 * and none of them runs faster on a stronger model. Every role used to share one
 * 180-second limit, while the coder method alone asked for a scan, a test run and a
 * mutation run.
 */
export function budgetForTier(
  tier: ModelTier,
  declaredTurns: number,
  baseUsd: number,
  declaredSeconds = 180,
): { maxTurns: number; maxUsd: number; timeoutMs: number } {
  const multiplier = TIER_BUDGET[tier];
  return {
    maxTurns: Math.ceil(declaredTurns * multiplier.turns),
    maxUsd: Number((baseUsd * multiplier.usd).toFixed(2)),
    timeoutMs: declaredSeconds * 1000,
  };
}
