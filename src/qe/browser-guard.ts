import { actionAllowed } from './exploration-policy.js';
import type { ExplorationPolicy } from './exploration-policy.js';

/**
 * Per-call enforcement of the half of the policy an allowlist cannot express.
 *
 * `browser-tools.ts` gates by **tool**: whether a role may click at all. That leaves
 * `denyLabels` and `maxActions` unenforced, because "never click *Delete account*" is
 * a statement about the **target**, and every click uses the same tool.
 * `actionAllowed` had been written and unit-tested for months with no caller in the
 * product; this is the caller.
 *
 * **`maxStates` is still enforced by nothing.** It bounds how many distinct states a
 * session may visit, and this guard has no notion of state — it sees one tool call at
 * a time and cannot tell a new page from a return to an old one. Enforcing it needs
 * the state model the driver will carry. Listed here rather than left implied,
 * because an earlier version of this comment claimed all three and delivered two.
 *
 * **A ceiling is not a target.** `maxActions` refuses the call after the limit; it
 * never encourages a session toward it. In practice the turn budget binds first —
 * `exploratory-tester` gets 30 turns against a local ceiling of 200 — so reaching
 * this limit at all should be read as a session that lost its focus, not as one that
 * used its allowance.
 *
 * Two layers, doing different jobs:
 *
 *   allowlist   can this role, here, click anything at all?
 *   this guard  may it click *that*, and has it clicked enough already?
 *
 * **What this cannot do.** Playwright MCP identifies a target by an opaque `ref` plus
 * an `element` description the model writes itself. The label check therefore reads
 * the model's own words. It catches the honest case — an agent that clicks "Delete
 * account" and says so — and a deliberately mis-described target walks straight past
 * it. That makes it a guard against accident, not against an adversary, and it is
 * worth having on that basis rather than on a stronger one. The action ceiling below
 * has no such weakness: it counts calls, whatever they claim to be.
 */

/** Tools that act on a named target, so the label rules apply to them. */
const TARGETED = new Set([
  'browser_click',
  'browser_check',
  'browser_uncheck',
  'browser_select_option',
  'browser_fill_form',
  'browser_type',
  'browser_press_sequentially',
  'browser_file_upload',
  'browser_drag',
  'browser_drop',
]);

/** Tools that change something, so they count against `maxActions`. */
const COUNTED = new Set([...TARGETED, 'browser_press_key', 'browser_handle_dialog']);

export interface GuardDecision {
  allowed: boolean;
  reason: string;
}

export interface BrowserGuard {
  /** Decide one call. Pure apart from the action counter. */
  check(toolName: string, input: Record<string, unknown>): GuardDecision;
  /** Actions spent so far, for the run summary. */
  spent(): number;
}

/**
 * The `element` field Playwright MCP asks the model to supply — "Human-readable
 * element description". Other shapes are tolerated so a renamed field degrades to
 * "no label found" rather than to an exception mid-run.
 */
function describedTarget(input: Record<string, unknown>): string {
  for (const key of ['element', 'text', 'name', 'selector']) {
    const value = input[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return '';
}

export function browserGuard(policy: ExplorationPolicy): BrowserGuard {
  let actions = 0;

  return {
    spent: () => actions,

    check(toolName, input) {
      // Names arrive qualified as mcp__playwright__browser_click.
      const bare = toolName.split('__').pop() ?? toolName;

      if (!COUNTED.has(bare)) return { allowed: true, reason: 'not an action' };

      if (actions >= policy.maxActions) {
        return {
          allowed: false,
          reason: `action ceiling reached (${policy.maxActions} for ${policy.environment}). Stop and report what you found rather than continuing.`,
        };
      }

      if (TARGETED.has(bare)) {
        const label = describedTarget(input);
        // `actionAllowed` wants a scanned control; the browser gives a description.
        // isSubmit is left false because nothing here can tell — the form-submit
        // decision was already made by the tool allowlist, which either granted
        // browser_fill_form or did not.
        const verdict = actionAllowed(policy, {
          label,
          tag: 'unknown',
          type: null,
          isSubmit: false,
        });
        if (!verdict.allowed) {
          return {
            allowed: false,
            reason: `${verdict.reason} Target described as "${label}". Report it as unexplored rather than finding another route to it.`,
          };
        }
      }

      actions += 1;
      return { allowed: true, reason: `action ${actions} of ${policy.maxActions}` };
    },
  };
}
