import { z } from 'zod';
import type { CaptureSummary } from '../capture/types.js';
import { runAgent } from './client.js';
import { Budget } from './budget.js';

export const triageVerdictSchema = z.object({
  classification: z.enum([
    'product-bug',
    'test-bug',
    'selector-rot',
    'infrastructure',
    'flaky',
    'unknown',
  ]),
  confidence: z.enum(['high', 'medium', 'low']),
  summary: z.string().min(10),
  /** Concrete observations the verdict rests on — no evidence, no verdict. */
  evidence: z.array(z.string()).min(1),
  suggestedFix: z.string().nullable(),
});

export type TriageVerdict = z.infer<typeof triageVerdictSchema>;

export interface TriageInput {
  testTitle: string;
  errorMessage: string;
  url?: string;
  network?: CaptureSummary;
}

export interface TriageResult {
  verdict: TriageVerdict | null;
  /** Set when the agent hit a budget limit or returned unparseable output. */
  degraded: string | null;
  costUsd: number;
}

const SYSTEM_PROMPT = `You triage failing Playwright tests for a QA engineering team.

You classify one failure into exactly one category:
- product-bug: the application is genuinely broken. The test is right.
- test-bug: the test's logic, data, or expectations are wrong. The app is right.
- selector-rot: the locator no longer matches, but the feature still works.
- infrastructure: auth, network, environment, or CI problem. Not a product signal.
- flaky: a race or timing dependency that would pass on a retry.

Rules:
- Ground every claim in the evidence given. Never invent a status code, endpoint, or DOM detail.
- Network evidence outranks the error message. A 4xx/5xx on a background call usually
  explains a UI assertion failure, and a 401/403 means infrastructure, not product.
- If the evidence does not support a call, use "unknown" with low confidence. Saying so is
  more useful than a confident guess.

Reply with a single JSON object and nothing else:
{"classification":"...","confidence":"high|medium|low","summary":"...","evidence":["..."],"suggestedFix":"... or null"}`;

function buildPrompt(input: TriageInput): string {
  const parts = [`Test: ${input.testTitle}`, `Error:\n${input.errorMessage}`];
  if (input.url) parts.push(`Page URL: ${input.url}`);

  if (input.network) {
    const { total, byStatus, failed, slowest } = input.network;
    parts.push(`Network: ${total} calls, status breakdown ${JSON.stringify(byStatus)}`);
    if (failed.length > 0) {
      const rows = failed
        .map((c) => `  ${c.method} ${c.path} -> ${c.failure ?? c.status} ${c.responseBody ?? ''}`)
        .join('\n');
      parts.push(`Failed calls:\n${rows}`);
    } else {
      parts.push('Failed calls: none — every request succeeded.');
    }
    if (slowest.length > 0) {
      parts.push(
        `Slowest: ${slowest.map((c) => `${c.method} ${c.path} ${c.durationMs}ms`).join(', ')}`,
      );
    }
  } else {
    parts.push('Network: not captured for this run.');
  }

  return parts.join('\n\n');
}

/** Pulls the JSON object out of a reply that may be fenced or prose-wrapped. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function triageFailure(input: TriageInput): Promise<TriageResult> {
  const budget = Budget.fromEnv({ maxTurns: 2 });
  const run = await runAgent({
    prompt: buildPrompt(input),
    systemPrompt: SYSTEM_PROMPT,
    allowedTools: [],
    budget,
  });

  if (run.stoppedBy !== null) {
    return { verdict: null, degraded: run.stoppedBy, costUsd: run.costUsd };
  }

  const parsed = triageVerdictSchema.safeParse(extractJson(run.text));
  if (!parsed.success) {
    return { verdict: null, degraded: 'agent returned unparseable output', costUsd: run.costUsd };
  }

  return { verdict: parsed.data, degraded: null, costUsd: run.costUsd };
}
