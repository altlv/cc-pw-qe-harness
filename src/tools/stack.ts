import type { Page } from '@playwright/test';

/**
 * Fingerprints the frontend before deciding how to test it.
 *
 * The harness cannot assume it is pointed at an app anyone here wrote. A React
 * SPA, a server-rendered Django page and a jQuery admin panel need different
 * selector strategies, different waiting strategies, and different assumptions
 * about whether a click causes a navigation or a re-render. Guessing wrong is
 * how a suite ends up full of arbitrary waits.
 *
 * Everything here is evidence-based: each signal names the artefact that proves
 * it, so a reader can check the claim rather than trust the label.
 */

export interface StackSignal {
  /** What was detected, e.g. "React". */
  name: string;
  /** The observable that proves it, e.g. "__REACT_DEVTOOLS_GLOBAL_HOOK__". */
  evidence: string;
  /** Version, when the page exposes one. */
  version: string | null;
}

export interface StackProfile {
  url: string;
  title: string;
  detectedAt: string;
  frameworks: StackSignal[];
  /**
   * Rendering model, inferred rather than declared:
   *  - `spa`             a client framework builds the DOM
   *  - `ssr-hydrated`    server HTML plus a meta-framework that takes over
   *  - `enhanced`        server HTML with a library sprinkled on top (jQuery,
   *                      htmx, Alpine). Not an SPA, and the difference matters:
   *                      most clicks still cause a real navigation.
   *  - `server-rendered` no framework evidence at all
   */
  rendering: 'spa' | 'ssr-hydrated' | 'enhanced' | 'server-rendered' | 'unknown';
  /**
   * The test-id attribute the app actually uses, counted from the DOM. Assuming
   * `data-testid` when the team writes `data-cy` produces a scan that reports
   * zero test ids on an app that is full of them.
   */
  testIdAttribute: { name: string; count: number } | null;
  /** All test-id-ish attributes seen, so a tie is visible rather than hidden. */
  testIdCandidates: { name: string; count: number }[];
  /** Shadow DOM defeats ordinary selectors; worth knowing up front. */
  webComponents: { customElements: string[]; shadowRoots: number };
  /** Present iff the page ships a router that swallows navigations. */
  clientRouting: boolean;
}

/** Frameworks that build the DOM themselves, so the served HTML is a shell. */
const CLIENT_RENDERING_FRAMEWORKS = [
  'React',
  'Vue',
  'Angular',
  'AngularJS',
  'Svelte',
  'Polymer',
  'Lit',
];

/** Frameworks that render on the server and then hydrate. */
const META_FRAMEWORKS = ['Next.js', 'Nuxt', 'Remix', 'SvelteKit'];

/** Attributes teams actually use for test hooks, in no particular priority. */
const TEST_ID_ATTRIBUTES = [
  'data-testid',
  'data-test-id',
  'data-test',
  'data-cy',
  'data-qa',
  'data-automation-id',
  'data-e2e',
];

/**
 * Runs in the page. Kept as one evaluate so the profile is a single consistent
 * snapshot rather than several reads of a moving target.
 */
export async function detectStack(page: Page): Promise<StackProfile> {
  const collected = await page.evaluate((testIdAttributes: string[]) => {
    const win = window as unknown as Record<string, unknown>;
    const signals: { name: string; evidence: string; version: string | null }[] = [];

    // No helper function here, deliberately. The bundler that runs this file
    // rewrites named function expressions to call a __name helper that does not
    // exist in page context, and the failure is an opaque ReferenceError.
    // Everything in this callback stays inline for that reason.

    // --- Frameworks -------------------------------------------------------
    if ('__REACT_DEVTOOLS_GLOBAL_HOOK__' in win || document.querySelector('[data-reactroot]')) {
      signals.push({
        name: 'React',
        evidence: '__REACT_DEVTOOLS_GLOBAL_HOOK__ / [data-reactroot]',
        version: null,
      });
    }

    if ('__NEXT_DATA__' in win) {
      signals.push({ name: 'Next.js', evidence: 'window.__NEXT_DATA__', version: null });
    }
    if ('__NUXT__' in win) {
      signals.push({ name: 'Nuxt', evidence: 'window.__NUXT__', version: null });
    }
    if ('__VUE__' in win || '__VUE_DEVTOOLS_GLOBAL_HOOK__' in win) {
      signals.push({ name: 'Vue', evidence: '__VUE_DEVTOOLS_GLOBAL_HOOK__', version: null });
    }

    const ngElement = document.querySelector('[ng-version]');
    if (ngElement !== null) {
      signals.push({
        name: 'Angular',
        evidence: '[ng-version]',
        version: ngElement.getAttribute('ng-version'),
      });
    } else if ('angular' in win) {
      signals.push({ name: 'AngularJS', evidence: 'window.angular', version: null });
    }

    if (document.querySelector('[class*="svelte-"]') !== null) {
      signals.push({ name: 'Svelte', evidence: 'svelte-* class hash', version: null });
    }
    if ('Alpine' in win) {
      signals.push({ name: 'Alpine.js', evidence: 'window.Alpine', version: null });
    }
    if ('htmx' in win) {
      signals.push({ name: 'htmx', evidence: 'window.htmx', version: null });
    }

    const jq = win['jQuery'] as { fn?: { jquery?: string } } | undefined;
    if (jq !== undefined) {
      signals.push({ name: 'jQuery', evidence: 'window.jQuery', version: jq.fn?.jquery ?? null });
    }

    if ('Turbo' in win || 'Turbolinks' in win) {
      signals.push({ name: 'Turbo/Turbolinks', evidence: 'window.Turbo', version: null });
    }
    if ('__remixContext' in win) {
      signals.push({ name: 'Remix', evidence: 'window.__remixContext', version: null });
    }
    // Polymer and Lit ship unmistakable markers; the shop reported "no frameworks"
    // while <dom-module> and <custom-style> sat in its own DOM.
    if ('Polymer' in win || document.querySelector('dom-module, custom-style') !== null) {
      signals.push({
        name: 'Polymer',
        evidence: 'window.Polymer / <dom-module>',
        version: null,
      });
    }
    if (
      'litElementVersions' in win ||
      'litHtmlVersions' in win ||
      'reactiveElementVersions' in win
    ) {
      signals.push({ name: 'Lit', evidence: 'window.litElementVersions', version: null });
    }

    if (document.querySelector('[data-sveltekit-preload-data]') !== null) {
      signals.push({
        name: 'SvelteKit',
        evidence: 'data-sveltekit-preload-data',
        version: null,
      });
    }

    // --- Test id attributes ----------------------------------------------
    const testIdCandidates = testIdAttributes
      .map((name) => ({ name, count: document.querySelectorAll(`[${name}]`).length }))
      .filter((candidate) => candidate.count > 0)
      .sort((left, right) => right.count - left.count);

    // --- Web components ---------------------------------------------------
    const customElements = [
      ...new Set(
        Array.from(document.querySelectorAll('*'))
          .map((element) => element.tagName.toLowerCase())
          .filter((tag) => tag.includes('-')),
      ),
    ].slice(0, 20);

    const shadowRoots = Array.from(document.querySelectorAll('*')).filter(
      (element) => element.shadowRoot !== null,
    ).length;

    // --- Client routing ---------------------------------------------------
    // Only positive evidence counts. An earlier version compared pushState
    // against a global that never exists, so every page looked client-routed.
    const clientRouting =
      '__NEXT_DATA__' in win ||
      '__NUXT__' in win ||
      '__remixContext' in win ||
      document.querySelector('a[data-sveltekit-preload-data], [ui-view], router-outlet') !== null;

    return {
      title: document.title,
      signals,
      testIdCandidates,
      customElements,
      shadowRoots,
      clientRouting,
      /** Server HTML that a framework later took over leaves both marks. */
      hasServerMarkup: document.documentElement.outerHTML.length > 0,
      bodyChildCount: document.body.childElementCount,
    };
  }, TEST_ID_ATTRIBUTES);

  const frameworks = collected.signals;
  const names = frameworks.map((signal) => signal.name);

  // Presence of *a* library says nothing about how the page is rendered. An
  // early version called a jQuery page an SPA, which would have sent a test
  // author looking for a client router that is not there.
  const rendersClientSide = names.some((name) => CLIENT_RENDERING_FRAMEWORKS.includes(name));
  const isMetaFramework = names.some((name) => META_FRAMEWORKS.includes(name));
  const routerish = collected.clientRouting || isMetaFramework;

  let rendering: StackProfile['rendering'];
  if (isMetaFramework) rendering = 'ssr-hydrated';
  else if (rendersClientSide) rendering = 'spa';
  else if (names.length > 0) rendering = 'enhanced';
  else rendering = 'server-rendered';

  return {
    url: page.url(),
    title: collected.title,
    detectedAt: new Date().toISOString(),
    frameworks,
    rendering,
    testIdAttribute: collected.testIdCandidates[0] ?? null,
    testIdCandidates: collected.testIdCandidates,
    webComponents: {
      customElements: collected.customElements,
      shadowRoots: collected.shadowRoots,
    },
    clientRouting: routerish,
  };
}

/** Plain-text rendering for a log file or an agent prompt. */
export function formatStack(profile: StackProfile): string {
  const lines: string[] = [];
  lines.push(`Stack profile: ${profile.url}`);
  lines.push(`  title      ${profile.title}`);
  lines.push(`  rendering  ${profile.rendering}`);

  if (profile.frameworks.length === 0) {
    lines.push('  frameworks none detected - treat links as real navigations');
  } else {
    lines.push('  frameworks');
    for (const signal of profile.frameworks) {
      const version = signal.version === null ? '' : ` v${signal.version}`;
      lines.push(`    ${signal.name}${version}  (${signal.evidence})`);
    }
  }

  if (profile.testIdAttribute === null) {
    lines.push('  test ids   none - selectors must fall back to role or text');
  } else {
    const others = profile.testIdCandidates.slice(1);
    lines.push(
      `  test ids   ${profile.testIdAttribute.name} on ${profile.testIdAttribute.count} element(s)`,
    );
    for (const candidate of others) {
      lines.push(`             also ${candidate.name} on ${candidate.count}`);
    }
  }

  if (profile.webComponents.shadowRoots > 0) {
    lines.push(
      `  shadow DOM ${profile.webComponents.shadowRoots} open root(s) - ordinary CSS will not pierce these`,
    );
  }
  if (profile.webComponents.customElements.length > 0) {
    lines.push(`  custom els ${profile.webComponents.customElements.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * What the profile means for a test author. Kept separate from detection so the
 * facts stay checkable and the advice stays arguable.
 */
export function stackAdvice(profile: StackProfile): string[] {
  const advice: string[] = [];

  if (profile.testIdAttribute === null) {
    advice.push(
      'No test-id attribute anywhere - which is the normal case, not a defect. Select by role and accessible name, and mark those selectors as text-dependent. What matters is that each one resolves to exactly one element; check the ambiguous count, not the test-id count.',
    );
  } else if (profile.testIdAttribute.name !== 'data-testid') {
    advice.push(
      `This app uses ${profile.testIdAttribute.name}, not data-testid. Set testIdAttribute in the Playwright config or getByTestId will find nothing.`,
    );
  }

  if (profile.clientRouting) {
    advice.push(
      'Client-side routing: a click re-renders instead of navigating. Do not wait for load events; assert on the content that should appear.',
    );
  }
  if (profile.rendering === 'server-rendered') {
    advice.push(
      'No framework detected. Interactions likely cause full page loads, so state does not survive between actions.',
    );
  }
  if (profile.rendering === 'enhanced') {
    advice.push(
      'Server-rendered HTML with a library layered on top - not an SPA. Expect a mix: some controls re-render in place, others navigate. Confirm per control rather than assuming one model.',
    );
  }
  if (profile.rendering === 'spa') {
    advice.push(
      'Client-rendered: the served HTML is a shell, so anything asserted straight after goto may not exist yet. Assert on content, never on the load event.',
    );
  }
  if (profile.webComponents.shadowRoots > 0) {
    advice.push(
      'Open shadow roots present, and the scan walks into them, so the controls listed above include ones inside web components. Playwright locators pierce open shadow DOM too — but a CSS descendant chain written by hand will not cross the boundary, and a closed root cannot be reached at all.',
    );
  }

  return advice;
}
