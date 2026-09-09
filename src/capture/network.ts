import type { Page, Request } from '@playwright/test';
import type { CapturedCall, CaptureSummary } from './types.js';

/** Noise that drowns out the calls a QA engineer actually cares about. */
const IGNORED_RESOURCE_TYPES = new Set(['image', 'stylesheet', 'font', 'media']);
const IGNORED_HOST_FRAGMENTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'sentry.io',
  'customer.io',
  'hotjar.com',
];

const MAX_BODY_CHARS = 4_000;

function isNoise(request: Request): boolean {
  if (IGNORED_RESOURCE_TYPES.has(request.resourceType())) return true;
  // Browser-initiated, never the behaviour under test, and its timing varies
  // enough to make "no failed calls" assertions flaky.
  if (pathOf(request.url()) === '/favicon.ico') return true;
  return IGNORED_HOST_FRAGMENTS.some((fragment) => request.url().includes(fragment));
}

function truncate(body: string | null): string | null {
  if (body === null) return null;
  return body.length > MAX_BODY_CHARS ? `${body.slice(0, MAX_BODY_CHARS)}…[truncated]` : body;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Records XHR/fetch/document traffic for a page.
 *
 * Playwright's trace viewer shows this interactively but nothing hands it to an
 * agent as text, which is exactly what triage and healing need: a 403 on a
 * background call explains a "button does nothing" failure that the DOM alone
 * cannot.
 */
export class NetworkRecorder {
  private readonly calls: CapturedCall[] = [];
  private readonly startTimes = new WeakMap<Request, number>();
  private readonly pending = new Set<Promise<void>>();

  private constructor() {}

  static attach(page: Page): NetworkRecorder {
    const recorder = new NetworkRecorder();

    page.on('request', (request) => {
      if (isNoise(request)) return;
      recorder.startTimes.set(request, Date.now());
    });

    page.on('requestfinished', (request) => {
      if (isNoise(request)) return;
      // Reading the body is async, but the handler must register its work
      // synchronously — otherwise settle() can return before this call lands and
      // an assertion right after the action sees an incomplete capture.
      recorder.track(
        (async () => {
          const response = await request.response();
          let responseBody: string | null = null;
          if (response) {
            const contentType = (await response.headerValue('content-type')) ?? '';
            // Only text-ish payloads; a binary body would be gibberish to an agent.
            if (/json|text|xml|javascript/i.test(contentType)) {
              responseBody = await response.text().catch(() => null);
            }
          }
          recorder.record(request, response?.status() ?? null, null, responseBody);
        })(),
      );
    });

    page.on('requestfailed', (request) => {
      if (isNoise(request)) return;
      recorder.record(request, null, request.failure()?.errorText ?? 'unknown failure', null);
    });

    return recorder;
  }

  private track(work: Promise<void>): void {
    const guarded = work.catch(() => undefined);
    this.pending.add(guarded);
    void guarded.finally(() => this.pending.delete(guarded));
  }

  /**
   * Waits for in-flight recordings to land. Call this before asserting on
   * captured traffic; a response that arrived is not necessarily recorded yet.
   */
  async settle(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending]);
    }
  }

  /**
   * Polls until a matching call has been recorded, or the timeout expires.
   *
   * Prefer this over `entries()` when asserting right after an action. Playwright
   * delivers network events to Node asynchronously, so the DOM can already show
   * the result of a request whose event has not reached the recorder yet —
   * `settle()` cannot help, because there is nothing pending to wait on.
   */
  async waitForCall(
    predicate: (call: CapturedCall) => boolean,
    timeoutMs = 5_000,
  ): Promise<CapturedCall | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      await this.settle();
      const found = this.calls.find(predicate);
      if (found !== undefined) return found;
      if (Date.now() >= deadline) return null;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private record(
    request: Request,
    status: number | null,
    failure: string | null,
    responseBody: string | null,
  ): void {
    const startedAt = this.startTimes.get(request);
    this.calls.push({
      method: request.method(),
      url: request.url(),
      path: pathOf(request.url()),
      status,
      failure,
      durationMs: startedAt === undefined ? null : Date.now() - startedAt,
      resourceType: request.resourceType(),
      requestBody: truncate(request.postData()),
      responseBody: truncate(responseBody),
      startedAt: new Date(startedAt ?? Date.now()).toISOString(),
    });
  }

  entries(): CapturedCall[] {
    return [...this.calls];
  }

  /** Transport failures and any 4xx/5xx. The first thing to look at on a red test. */
  failures(): CapturedCall[] {
    return this.calls.filter((call) => call.failure !== null || (call.status ?? 0) >= 400);
  }

  /** Compact shape for handing to an agent without blowing the context budget. */
  summarize(slowestCount = 3): CaptureSummary {
    const byStatus: Record<string, number> = {};
    for (const call of this.calls) {
      const key = call.failure !== null ? 'failed' : String(call.status ?? 'unknown');
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }
    const slowest = [...this.calls]
      .filter((call) => call.durationMs !== null)
      .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
      .slice(0, slowestCount);

    return { total: this.calls.length, failed: this.failures(), slowest, byStatus };
  }
}
