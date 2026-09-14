import type { GuardDecision } from './browser-guard.js';
import { insideDir } from './run-worktree.js';

/**
 * The guard on the file tools: every path stays inside the run's worktree.
 *
 * A worktree separates a run's effects only if the run stays in it. The file tools take
 * absolute paths, so without this an agent could edit the main checkout — a person's
 * uncommitted work — or read files the run was never given. Reading counts too: what a
 * run reads from outside its base commit is shared state leaking in.
 *
 * `.env` and its variants are refused even inside the worktree. It is not committed, so
 * a worktree never has one, and a path that names one is looking for secrets.
 *
 * **What this cannot do.** `Bash` is not a file tool. An agent can `cd` out of the
 * worktree in a shell; the shell guard refuses git writes and secrets there, not every
 * path. Said so rather than implied.
 */

/** Each file tool, and the input fields that carry a path. */
const PATH_FIELDS: Record<string, string[]> = {
  Read: ['file_path'],
  Write: ['file_path'],
  Edit: ['file_path'],
  MultiEdit: ['file_path'],
  NotebookEdit: ['notebook_path'],
  Glob: ['path'],
  Grep: ['path'],
};

const SECRET_FILE = /(?:^|[\\/])\.env(?:\.(?!example$)[\w-]+)?$/;

export function fileToolGuard(root: string): {
  /** A decision for a file tool, or null when the tool is not one. */
  check(toolName: string, input: Record<string, unknown>): GuardDecision | null;
} {
  return {
    check(toolName, input) {
      const fields = PATH_FIELDS[toolName];
      if (fields === undefined) return null;
      for (const field of fields) {
        const value = input[field];
        if (typeof value !== 'string' || value.trim() === '') continue;
        if (SECRET_FILE.test(value.trim())) {
          return {
            allowed: false,
            reason: `${toolName} on ${value} is refused: .env holds secrets. If a value is needed, say so in your report.`,
          };
        }
        if (!insideDir(value, root)) {
          return {
            allowed: false,
            reason: `${toolName} on ${value} is refused: this run works only inside its worktree (${root}). The main checkout is someone else's state.`,
          };
        }
      }
      return { allowed: true, reason: 'inside the worktree' };
    },
  };
}
