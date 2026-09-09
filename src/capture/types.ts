export interface CapturedCall {
  method: string;
  url: string;
  /** Path only, domain stripped — what you assert on. */
  path: string;
  status: number | null;
  /** null when the request never produced a response (aborted, connection refused). */
  failure: string | null;
  durationMs: number | null;
  resourceType: string;
  requestBody: string | null;
  responseBody: string | null;
  startedAt: string;
}

export interface CaptureSummary {
  total: number;
  failed: CapturedCall[];
  slowest: CapturedCall[];
  byStatus: Record<string, number>;
}
