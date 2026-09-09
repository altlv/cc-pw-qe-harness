import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { Budget } from './budget.js';

export interface AgentRunResult {
  /** Final assistant text. Empty when the run was cut short before answering. */
  text: string;
  turns: number;
  costUsd: number;
  elapsedMs: number;
  /** Budget limit that ended the run, or null if it finished on its own. */
  stoppedBy: string | null;
}

export interface AgentRunOptions {
  prompt: string;
  systemPrompt: string;
  budget?: Budget;
  allowedTools?: string[];
  mcpServers?: Options['mcpServers'];
  cwd?: string;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function model(): string {
  return process.env.HARNESS_MODEL?.trim() || 'claude-sonnet-5';
}

/**
 * Runs one bounded agent turn-loop and returns its final text.
 *
 * `settingSources: []` keeps the run hermetic — without it the SDK would pick up
 * whatever CLAUDE.md and settings the developer happens to have locally, so the
 * same harness would behave differently on two machines and in CI.
 */
export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
  if (!hasApiKey()) {
    throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.');
  }

  const budget = options.budget ?? Budget.fromEnv();
  // The per-message check below only fires when a message arrives; this catches a
  // run that goes quiet mid-tool-call and would otherwise hang past the limit.
  const timer = setTimeout(() => budget.abort('wall-clock timeout'), budget.limits.timeoutMs);
  timer.unref();

  let text = '';
  let stoppedBy: string | null = null;

  try {
    const response = query({
      prompt: options.prompt,
      options: {
        model: model(),
        systemPrompt: options.systemPrompt,
        maxTurns: budget.limits.maxTurns,
        allowedTools: options.allowedTools,
        mcpServers: options.mcpServers,
        cwd: options.cwd,
        permissionMode: 'bypassPermissions',
        settingSources: [],
        abortController: budget.controller,
      },
    });

    for await (const message of response) {
      if (message.type === 'result') {
        budget.record({ turns: message.num_turns, costUsd: message.total_cost_usd });
        if (message.subtype === 'success') {
          text = message.result;
        } else {
          stoppedBy = `agent ended with subtype "${message.subtype}"`;
        }
      }

      const limit = budget.exceeded();
      if (limit !== null && stoppedBy === null) {
        stoppedBy = budget.abort(limit);
        break;
      }
    }
  } catch (error) {
    if (budget.controller.signal.aborted) {
      stoppedBy ??= 'aborted';
    } else {
      throw error;
    }
  } finally {
    clearTimeout(timer);
  }

  const spent = budget.spent();
  return {
    text,
    turns: spent.turns,
    costUsd: spent.costUsd,
    elapsedMs: spent.elapsedMs,
    stoppedBy,
  };
}
