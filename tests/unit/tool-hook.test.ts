import { test, expect } from '@playwright/test';
import type { HookInput } from '@anthropic-ai/claude-agent-sdk';
import { decideToolUse, guardHook, type ToolCheck } from '../../src/qe/tool-hook.js';

/**
 * The hook is the only path by which a guard reaches a live run. It must deny in the
 * shape the SDK acts on, allow without interfering, and refuse when its own check
 * throws.
 */

const preToolUse = (toolName: string, toolInput: unknown): HookInput =>
  ({
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: 'id',
    session_id: 's',
    transcript_path: 't',
    cwd: '.',
  }) as unknown as HookInput;

const refuseBash: ToolCheck = (toolName, input) =>
  toolName === 'Bash' && String(input.command).includes('git push')
    ? { allowed: false, reason: 'no pushing' }
    : { allowed: true, reason: 'fine' };

const signal = new AbortController().signal;

test.describe('the guard hook', () => {
  test('should deny in the shape the SDK acts on', async () => {
    const denied: string[] = [];
    const hook = guardHook(refuseBash, (tool, reason) => denied.push(`${tool}: ${reason}`));
    const output = await hook.hooks[0]!(preToolUse('Bash', { command: 'git push' }), 'id', {
      signal,
    });
    expect(output, 'anything but permissionDecision "deny" lets the call through').toEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'no pushing',
      },
    });
    expect(denied).toEqual(['Bash: no pushing']);
  });

  test('should let an allowed call continue untouched', async () => {
    const hook = guardHook(refuseBash);
    const output = await hook.hooks[0]!(preToolUse('Bash', { command: 'git status' }), 'id', {
      signal,
    });
    expect(output).toEqual({ continue: true });
  });

  test('should refuse when the check itself throws', () => {
    const broken: ToolCheck = () => {
      throw new Error('boom');
    };
    const { decision } = decideToolUse(broken, preToolUse('Bash', { command: 'ls' }));
    expect(
      decision.allowed,
      'a guard that failed to decide must not read as a guard that allowed',
    ).toBe(false);
  });

  test('should ignore events that are not tool calls', () => {
    const { decision } = decideToolUse(refuseBash, {
      hook_event_name: 'SessionStart',
    } as unknown as HookInput);
    expect(decision.allowed).toBe(true);
  });
});
