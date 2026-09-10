import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, basename } from 'node:path';
import type { Page } from '@playwright/test';
import type { NetworkRecorder } from '../capture/network.js';
import type { CapturedCall } from '../capture/types.js';
import { scanPage, formatScan, type PageScan } from './page-scanner.js';
import { detectStack, formatStack, stackAdvice, type StackProfile } from './stack.js';
import { buildDataDictionary, formatDictionary, type EndpointShape } from './schema.js';

/**
 * One pass over a page, producing everything a test author needs before writing
 * a line: what the frontend is, which elements exist, and which values move
 * across the wire.
 *
 * The three questions are deliberately answered together. Elements without
 * payloads tell you what to click but not what to assert; payloads without a
 * stack profile tell you what to assert but not how to select.
 */

export interface ProbeResult {
  stack: StackProfile;
  scan: PageScan;
  dictionary: EndpointShape[];
  /** Every captured call, in order. The raw log behind the dictionary. */
  calls: CapturedCall[];
}

export async function probePage(
  page: Page,
  network: NetworkRecorder,
  options: { within?: string } = {},
): Promise<ProbeResult> {
  const stack = await detectStack(page);

  // The scanner used to assume data-testid. Ask the page which attribute it
  // actually uses — on an app that writes data-cy, assuming the default reports
  // zero test ids for an app that is full of them.
  const scan = await scanPage(page, {
    ...(options.within !== undefined ? { within: options.within } : {}),
    ...(stack.testIdAttribute !== null ? { testIdAttribute: stack.testIdAttribute.name } : {}),
  });

  await network.settle();
  const calls = network.entries();

  scan.endpoints = calls
    .filter((call) => call.resourceType === 'fetch' || call.resourceType === 'xhr')
    .map((call) => ({ method: call.method, path: call.path, status: call.status }));

  return { stack, scan, dictionary: buildDataDictionary(calls), calls };
}

/** The human- and agent-readable digest. This is what goes in a prompt. */
export function formatProbe(result: ProbeResult): string {
  const sections = [
    formatStack(result.stack),
    '',
    formatScan(result.scan),
    '',
    '--- Data dictionary (from captured traffic) ---',
    '',
    formatDictionary(result.dictionary),
  ];

  const advice = stackAdvice(result.stack);
  if (advice.length > 0) {
    sections.push('', '--- What this means for selectors and waiting ---', '');
    for (const item of advice) sections.push(`- ${item}`);
  }

  return sections.join('\n');
}

export interface WrittenArtifacts {
  json: string;
  ndjson: string;
  txt: string;
}

/**
 * Writes three files, because three different readers need three shapes.
 *
 *  - `.json`   the structured record. Diffable, and what tests assert against.
 *  - `.ndjson` the raw call log, one JSON object per line. This is the proxy
 *              log: greppable with ordinary tools, and the evidence behind
 *              every claim in the other two files.
 *  - `.txt`    the rendered digest. Cheap to read and cheap to paste into an
 *              agent prompt, where JSON punctuation is just token cost.
 *
 * The text file is generated from the JSON, never hand-maintained, so the two
 * cannot drift.
 */
export async function writeProbeArtifacts(
  result: ProbeResult,
  outPath: string,
): Promise<WrittenArtifacts> {
  const dir = dirname(outPath);
  const stem = basename(outPath, extname(outPath));
  await mkdir(dir, { recursive: true });

  const json = join(dir, `${stem}.json`);
  const ndjson = join(dir, `${stem}.network.ndjson`);
  const txt = join(dir, `${stem}.txt`);

  await writeFile(
    json,
    JSON.stringify(
      { stack: result.stack, scan: result.scan, dictionary: result.dictionary },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(ndjson, result.calls.map((call) => JSON.stringify(call)).join('\n'), 'utf8');

  await writeFile(txt, `${formatProbe(result)}\n`, 'utf8');

  return { json, ndjson, txt };
}
