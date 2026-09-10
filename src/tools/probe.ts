import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, basename } from 'node:path';
import type { Page } from '@playwright/test';
import type { NetworkRecorder } from '../capture/network.js';
import type { CapturedCall } from '../capture/types.js';
import { scanPage, formatScan, type PageScan } from './page-scanner.js';
import { detectStack, formatStack, stackAdvice, type StackProfile } from './stack.js';
import { buildDataDictionary, formatDictionary, type EndpointShape } from './schema.js';
import { detectInterstitial, formatInterstitial, type Interstitial } from './interstitial.js';
import {
  detectHoverReveals,
  detectKeyboardProfile,
  detectLateArrivals,
  detectResponsiveDiff,
  detectScrollReveals,
  detectZoomReflow,
  formatReveals,
  type KeyboardProfile,
  type Reveal,
} from './reveal.js';

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
  /** Set when the page under the scan is not the application. */
  interstitial: Interstitial | null;
  /** What a static snapshot cannot see. Empty unless the deep pass was asked for. */
  hoverReveals: Reveal[];
  keyboard: KeyboardProfile | null;
  responsive: Reveal | null;
  lateArrivals: Reveal | null;
  scroll: Awaited<ReturnType<typeof detectScrollReveals>> | null;
  zoom: Awaited<ReturnType<typeof detectZoomReflow>> | null;
  /** Every captured call, in order. The raw log behind the dictionary. */
  calls: CapturedCall[];
}

export async function probePage(
  page: Page,
  network: NetworkRecorder,
  options: { within?: string; hover?: boolean } = {},
): Promise<ProbeResult> {
  const stack = await detectStack(page);

  // A client-rendered app is a shell at domcontentloaded. Scanning there reported
  // 2 controls on a Polymer list page that has 37 once rendered — we detected the
  // SPA and then scanned it as though it were static. Wait for what the profile
  // says this page needs, and never longer.
  if (stack.rendering === 'spa' || stack.rendering === 'ssr-hydrated') {
    await page.waitForLoadState('load').catch(() => undefined);
    // networkidle is best-effort: an app that polls never reaches it, and waiting
    // out that timeout on every scan would be worse than scanning slightly early.
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }

  // The scanner used to assume data-testid. Ask the page which attribute it
  // actually uses — on an app that writes data-cy, assuming the default reports
  // zero test ids for an app that is full of them.
  const scan = await scanPage(page, {
    ...(options.within !== undefined ? { within: options.within } : {}),
    ...(stack.testIdAttribute !== null ? { testIdAttribute: stack.testIdAttribute.name } : {}),
  });

  // Opt-in: these probe a live page and cost real seconds. All four are read-only
  // — hovering, focusing, resizing and waiting submit nothing — so they are the
  // passes that remain available when clicking does not.
  const deep = options.hover === true;
  const hoverReveals = deep ? await detectHoverReveals(page) : [];
  const keyboard = deep ? await detectKeyboardProfile(page) : null;
  const responsive = deep ? await detectResponsiveDiff(page) : null;
  const lateArrivals = deep ? await detectLateArrivals(page) : null;
  const scroll = deep ? await detectScrollReveals(page) : null;
  const zoom = deep ? await detectZoomReflow(page) : null;

  await network.settle();
  const calls = network.entries();

  // Asked last, reported first: everything above describes whatever page we
  // actually landed on, and a challenge or login wall makes all of it a
  // description of the wrong thing.
  const interstitial = await detectInterstitial(page, calls);

  scan.endpoints = calls
    .filter((call) => call.resourceType === 'fetch' || call.resourceType === 'xhr')
    .map((call) => ({ method: call.method, path: call.path, status: call.status }));

  return {
    stack,
    interstitial,
    scan,
    dictionary: buildDataDictionary(calls),
    hoverReveals,
    keyboard,
    responsive,
    lateArrivals,
    scroll,
    zoom,
    calls,
  };
}

/** The human- and agent-readable digest. This is what goes in a prompt. */
export function formatProbe(result: ProbeResult): string {
  const sections = [
    ...(result.interstitial !== null ? [formatInterstitial(result.interstitial), ''] : []),
    formatStack(result.stack),
    '',
    formatScan(result.scan),
    '',
    '--- Data dictionary (from captured traffic) ---',
    '',
    formatDictionary(result.dictionary),
  ];

  if (
    result.hoverReveals.length > 0 ||
    result.keyboard !== null ||
    result.responsive !== null ||
    result.lateArrivals !== null
  ) {
    sections.push(
      '',
      formatReveals(
        result.hoverReveals,
        result.keyboard,
        result.responsive,
        result.lateArrivals,
        result.scroll,
        result.zoom,
      ),
    );
  }

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
