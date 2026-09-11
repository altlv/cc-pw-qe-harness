import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, basename } from 'node:path';
import type { Page } from '@playwright/test';
import type { NetworkRecorder } from '../capture/network.js';
import type { CapturedCall } from '../capture/types.js';
import { scanPage, formatScan, type PageScan, type Settling } from './page-scanner.js';
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
  type ZoomResult,
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
  /** Whether the page had finished adding to itself when the inventory was taken. */
  settled: Settling;
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
  // SPA and then scanned it as though it were static.
  //
  // The wait used to be for `spa` and `ssr-hydrated` only, which excluded the one
  // tier that most needed it. `enhanced` means server-rendered HTML with JavaScript
  // adding things afterwards — WordPress with plugins, Rails with Turbo, a jQuery
  // shop — and it is the dominant shape of the real web. On a real cart page the
  // quantity input, declaring `min=1 max=10`, was absent at domcontentloaded and at
  // load, and present by networkidle. The scan happened at the first of those, so a
  // boundary the page had written down never reached the map.
  //
  // So: settle unconditionally. Gating it on the rendering tier looked careful and
  // was not — the tier is inferred from framework signals, and a page with no
  // framework at all can still append to itself after load. Any rule that decides
  // *whether* to wait is a rule that can be wrong about a page, and the cost of
  // being wrong is a map that quietly omits things. A static page reaches
  // networkidle almost immediately, so waiting always costs close to nothing.
  await page.waitForLoadState('load').catch(() => undefined);
  // networkidle is best-effort: an app that polls never reaches it, and waiting out
  // that timeout on every scan would be worse than scanning slightly early. When it
  // does time out the inventory is a floor, and the map has to say so rather than
  // present a short list as a complete one.
  const settledTo: Settling = await page
    .waitForLoadState('networkidle')
    .then((): Settling => 'settled')
    .catch((): Settling => 'timed-out');
  void stack.rendering;

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
    settled: settledTo,
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

/**
 * Defects the deep passes found, pulled out of the technical report.
 *
 * A 200% reflow failure is not a fact about the play area, it is a product defect
 * with a standard behind it — and it used to be printed inside a section headed
 * "What a static scan cannot see", where it read as trivia.
 *
 * Deliberately narrow. A control hidden at 375px is *not* listed: this harness
 * cannot tell "replaced by a hamburger menu" from "gone", and the honest place
 * for something we cannot judge is the map, as a question.
 *
 * Pure, and exported for that reason. A surviving mutation showed why: the rule
 * lived inside a function that needed a browser, so nothing in the suite could
 * reach it and blanking it left everything green.
 */
export function deepPassDefects(zoom: ZoomResult | null): string[] {
  const found: string[] = [];
  if (zoom === null) return found;

  if (zoom.horizontalOverflow) {
    found.push(
      `  [high] reflow  content runs ${zoom.overflowPx}px past the viewport at ${zoom.percent}%`,
      '      WCAG 1.4.10. Anyone who needs magnification has to scroll sideways to read a line.',
    );
  }
  for (const control of zoom.tiny.slice(0, 5)) {
    found.push(
      `  [medium] small-target  ${control}`,
      '      Click target under 24x24 CSS px (WCAG 2.5.8).',
    );
  }
  for (const control of zoom.lost.slice(0, 5)) {
    found.push(
      `  [high] lost-at-zoom  ${control}`,
      `      Visible at 100%, not visible at ${zoom.percent}%.`,
    );
  }
  return found;
}

/** The human- and agent-readable digest. This is what goes in a prompt. */
export function formatProbe(result: ProbeResult): string {
  const sections = [
    ...(result.interstitial !== null ? [formatInterstitial(result.interstitial), ''] : []),
    formatStack(result.stack),
    '',
    formatScan(result.scan, {
      alsoProduct: deepPassDefects(result.zoom),
      settled: result.settled,
    }),
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
