import type { CapturedCall } from '../capture/types.js';

/**
 * Turns captured network traffic into a data dictionary.
 *
 * The scanner tells you which elements a page has. This tells you which *values*
 * the app moves around: field names, types, whether something is ever null, and
 * a real sample. That is the half a DOM scan cannot see, and the half a test
 * author needs in order to assert on anything beyond visibility.
 *
 * Deliberately shape-only. Bodies are read for their structure and a short
 * sample; this is not a place to park a full response.
 */

export type JsonType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';

export interface FieldShape {
  /** Dotted path within the payload. Array elements collapse to `[]`. */
  path: string;
  /** Every type observed at this path. More than one is worth knowing about. */
  types: JsonType[];
  /** Some observed value was null. */
  nullable: boolean;
  /** Absent from at least one payload of the same group. Top-level fields only. */
  optional: boolean;
  /** First non-null scalar seen, truncated. Real data teaches more than a type name. */
  sample: string | null;
  /** How many payloads carried this field. */
  seen: number;
}

export interface EndpointShape {
  method: string;
  /** Path with id-shaped segments replaced, so repeated calls group. */
  template: string;
  /** Concrete paths that collapsed into the template. Bounded. */
  examples: string[];
  statuses: number[];
  calls: number;
  request: FieldShape[];
  response: FieldShape[];
}

const MAX_SAMPLE_CHARS = 60;
const MAX_ARRAY_ELEMENTS = 5;
const MAX_DEPTH = 6;
const MAX_EXAMPLES = 3;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX = /^[0-9a-f]{16,}$/i;

/**
 * `/api/v1/Books/42` and `/api/v1/Books/43` are one endpoint, not two. Without
 * this, a list page that renders fifty rows yields fifty "endpoints" and the
 * dictionary is noise.
 */
export function templatePath(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (segment === '') return segment;
      if (/^\d+$/.test(segment)) return '{id}';
      if (UUID.test(segment)) return '{uuid}';
      if (LONG_HEX.test(segment)) return '{hash}';
      return segment;
    })
    .join('/');
}

function typeOf(value: unknown): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value === 'object' ? 'object' : (typeof value as JsonType);
}

function sampleOf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return null;
  const text = String(value);
  return text.length > MAX_SAMPLE_CHARS ? `${text.slice(0, MAX_SAMPLE_CHARS)}...` : text;
}

interface Accumulator {
  types: Set<JsonType>;
  nullable: boolean;
  sample: string | null;
  seen: number;
}

function walk(value: unknown, path: string, depth: number, into: Map<string, Accumulator>): void {
  if (depth > MAX_DEPTH) return;

  const type = typeOf(value);
  let acc = into.get(path);
  if (acc === undefined) {
    acc = { types: new Set(), nullable: false, sample: null, seen: 0 };
    into.set(path, acc);
  }
  acc.types.add(type);
  acc.seen += 1;
  if (type === 'null') acc.nullable = true;
  acc.sample ??= sampleOf(value);

  if (type === 'array') {
    // Elements of one array are one shape. Merging them is the point: it is how
    // a field that only appears on the third row gets noticed as optional.
    for (const element of (value as unknown[]).slice(0, MAX_ARRAY_ELEMENTS)) {
      walk(element, `${path}[]`, depth + 1, into);
    }
  } else if (type === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, path === '' ? key : `${path}.${key}`, depth + 1, into);
    }
  }
}

function parse(body: string | null): unknown {
  if (body === null || body.trim() === '') return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/** Merges the payloads of several calls into one field list. */
export function inferShape(payloads: unknown[]): FieldShape[] {
  const present = payloads.filter((payload) => payload !== undefined);
  if (present.length === 0) return [];

  const acc = new Map<string, Accumulator>();
  for (const payload of present) walk(payload, '', 0, acc);

  const rootSeen = acc.get('')?.seen ?? present.length;

  return [...acc.entries()]
    .filter(([path]) => path !== '')
    .map(([path, entry]) => ({
      path,
      types: [...entry.types].sort(),
      nullable: entry.nullable,
      // A field on an array element legitimately appears more often than the
      // root, so optionality is only meaningful for top-level fields.
      optional: !path.includes('[]') && !path.includes('.') && entry.seen < rootSeen,
      sample: entry.sample,
      seen: entry.seen,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

/**
 * Groups captured calls by method and templated path, and infers request and
 * response shapes for each group.
 */
export function buildDataDictionary(calls: CapturedCall[]): EndpointShape[] {
  const apiCalls = calls.filter(
    (call) => call.resourceType === 'fetch' || call.resourceType === 'xhr',
  );

  const groups = new Map<string, CapturedCall[]>();
  for (const call of apiCalls) {
    const key = `${call.method} ${templatePath(call.path)}`;
    const existing = groups.get(key);
    if (existing === undefined) groups.set(key, [call]);
    else existing.push(call);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const separator = key.indexOf(' ');
      return {
        method: key.slice(0, separator),
        template: key.slice(separator + 1),
        examples: [...new Set(group.map((call) => call.path))].slice(0, MAX_EXAMPLES),
        statuses: [
          ...new Set(group.map((call) => call.status).filter((status) => status !== null)),
        ].sort((left, right) => left - right),
        calls: group.length,
        request: inferShape(group.map((call) => parse(call.requestBody))),
        response: inferShape(group.map((call) => parse(call.responseBody))),
      };
    })
    .sort(
      (left, right) =>
        left.template.localeCompare(right.template) || left.method.localeCompare(right.method),
    );
}

/** Plain-text rendering, for a log file or for pasting into an agent prompt. */
export function formatDictionary(endpoints: EndpointShape[]): string {
  if (endpoints.length === 0) {
    return 'No XHR/fetch traffic captured. Either the page is server-rendered, or the\ninteresting calls happen behind an interaction the scan never performed.';
  }

  const lines: string[] = [];
  for (const endpoint of endpoints) {
    const statuses = endpoint.statuses.length > 0 ? endpoint.statuses.join(', ') : 'no response';
    lines.push(`${endpoint.method} ${endpoint.template}  [${statuses}]  x${endpoint.calls}`);

    const section = (label: string, fields: FieldShape[]): void => {
      if (fields.length === 0) return;
      lines.push(`  ${label}:`);
      for (const field of fields) {
        const flags = [
          field.types.join('|'),
          field.nullable ? 'nullable' : null,
          field.optional ? 'optional' : null,
        ]
          .filter((flag) => flag !== null)
          .join(', ');
        const sample = field.sample === null ? '' : `  e.g. ${field.sample}`;
        lines.push(`    ${field.path}  (${flags})${sample}`);
      }
    };

    section('request', endpoint.request);
    section('response', endpoint.response);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
