import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * One run per target at a time.
 *
 * Each run works in its own worktree, so runs never collide over files. What a worktree
 * cannot separate is the deployment a run points at: two runs writing to the same `test`
 * environment still meet each other's data. So the lock is keyed on app and environment,
 * and runs against different targets proceed side by side. A run with no target — a unit
 * coder on the harness's own code — takes no lock.
 *
 * A lock left by a run that died is replaced, not obeyed — a crash must not block every
 * later run until someone deletes a file by hand.
 */

export function lockPathFor(app: string, environment: string): string {
  return `artifacts/locks/${app}-${environment}.lock`;
}

export interface LockRecord {
  pid: number;
  role: string;
  startedAt: string;
}

export type LockDecision =
  { take: true; replacedStale: LockRecord | null } | { take: false; heldBy: LockRecord };

export function decideLock(
  existing: LockRecord | null,
  alive: (pid: number) => boolean,
): LockDecision {
  if (existing === null) return { take: true, replacedStale: null };
  if (!alive(existing.pid)) return { take: true, replacedStale: existing };
  return { take: false, heldBy: existing };
}

export function processAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists and belongs to someone else — still alive.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** The lock's holder, or null when there is no lock. An unreadable lock holds nothing. */
function readLock(path: string): LockRecord | null {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as Partial<LockRecord>;
    return {
      pid: typeof parsed.pid === 'number' ? parsed.pid : -1,
      role: parsed.role ?? 'unknown',
      startedAt: parsed.startedAt ?? 'unknown',
    };
  } catch {
    return { pid: -1, role: 'unknown', startedAt: 'unknown' };
  }
}

export function acquireLock(
  record: LockRecord,
  path: string,
  alive: (pid: number) => boolean = processAlive,
): LockDecision {
  mkdirSync(dirname(path), { recursive: true });
  const decision = decideLock(readLock(path), alive);
  if (!decision.take) return decision;
  if (decision.replacedStale !== null) rmSync(path, { force: true });
  try {
    // Exclusive create: two runs starting in the same instant cannot both win.
    const fd = openSync(path, 'wx');
    writeSync(fd, JSON.stringify(record));
    closeSync(fd);
  } catch {
    return { take: false, heldBy: readLock(path) ?? record };
  }
  return decision;
}

/** Releases the lock only if this process holds it. */
export function releaseLock(pid: number, path: string): void {
  if (readLock(path)?.pid === pid) rmSync(path, { force: true });
}
