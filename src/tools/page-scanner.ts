import type { Page } from '@playwright/test';
import { accessibleNameFrom, type NameParts } from './accessible-name.js';

/**
 * Testability, as this harness defines it:
 *
 *   the ability to **identify** and **interact with** the available elements and
 *   objects, easily enough.
 *
 * All three parts carry weight. *Identify* is addressing one specific thing and
 * no other. *Interact* is being able to act on it once found — which is not
 * implied by finding it. *Easily enough* is the pragmatic bar: a workable route
 * counts, and it does not have to be the ideal one.
 *
 * Test ids are one way to satisfy the first half and were inherited from the
 * tooling, not from the definition. Most applications do not have them and are
 * testable anyway, so their absence is not reported as a defect here. What gets
 * reported is a failure of the definition itself:
 *
 *   identify   ambiguous (matches several) · unaddressable (position only)
 *   interact   disabled · readonly · covered by an overlay · off-screen
 *   observe    acted on, with no state exposed to assert against
 *
 * The last one matters most for exploration: an interaction whose outcome cannot
 * be observed yields no hypothesis to test.
 *
 * "Objects" in the definition extends past the DOM — the data dictionary in
 * `schema.ts` covers the values moving underneath.
 */

/** What you can do with an element. */
export type Affordance = 'input' | 'submit' | 'toggle' | 'control' | 'navigation';

export interface InputConstraints {
  name: string | null;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  /** Current value, truncated. The starting point for any boundary probe. */
  value: string | null;
  min: string | null;
  max: string | null;
  step: string | null;
  pattern: string | null;
  maxLength: number | null;
  /** For select elements: the option values on offer. */
  options: string[];
}

export interface ScannedElement {
  tag: string;
  type: string | null;
  role: string | null;
  accessibleName: string | null;
  testId: string | null;
  affordance: Affordance;
  /** Selector a generated test should use, best available. */
  suggested: string;
  /** False when `suggested` matches more than one element on the page. */
  unique: boolean;
  /** How much a test built on `suggested` can be trusted. */
  stability: 'stable' | 'text-dependent' | 'fragile';
  /** Populated for inputs, selects and textareas. */
  constraints: InputConstraints | null;
  /**
   * ARIA/DOM attributes that expose this control's state, e.g. `aria-expanded`.
   * Empty means acting on it produces nothing a test can assert against.
   */
  stateAttributes: Record<string, string>;
  /** Index of the form it belongs to, or null when it is not in one. */
  formIndex: number | null;
  /**
   * Why this element cannot be acted on, or null when it can. Being findable and
   * being usable are different halves of testability.
   */
  blocker: string | null;
}

export interface TestabilityIssue {
  severity: 'high' | 'medium';
  kind:
    | 'ambiguous'
    | 'unaddressable'
    | 'no-observable-state'
    | 'unlabelled-input'
    | 'unreachable'
    | 'unscanned-frame'
    | 'unscanned-shadow-root';
  element: string;
  problem: string;
  suggestion: string;
}

export interface PageScan {
  url: string;
  title: string;
  scannedAt: string;
  counts: {
    interactive: number;
    inputs: number;
    submits: number;
    stateful: number;
    /** Addressable but not actionable right now — the interact half. */
    blocked: number;
    withTestId: number;
    forms: number;
    tables: number;
  };
  /** Frame sources present on the page. Not scanned — an admitted blind spot. */
  frames: string[];
  /** Custom elements holding an open shadow root. Also not scanned. */
  shadowHosts: string[];
  interactive: ScannedElement[];
  endpoints: { method: string; path: string; status: number | null }[];
  testability: TestabilityIssue[];
}

/** Attributes that carry a control's state, and so make an outcome assertable. */
const STATE_ATTRIBUTES = [
  'aria-expanded',
  'aria-pressed',
  'aria-checked',
  'aria-selected',
  'aria-current',
  'aria-invalid',
  'aria-disabled',
  'aria-busy',
  'open',
  'checked',
  'disabled',
];

/**
 * Names that imply the control flips between two states. Such a control with no
 * state attribute is a real finding: you can press it and cannot prove anything
 * happened.
 */
const TOGGLE_WORDS = [
  'show',
  'hide',
  'expand',
  'collapse',
  'open',
  'close',
  'start',
  'stop',
  'play',
  'pause',
  'mute',
  'unmute',
  'enable',
  'disable',
  'toggle',
  'more',
  'less',
];

export async function scanPage(
  page: Page,
  options: { within?: string; testIdAttribute?: string } = {},
): Promise<PageScan> {
  const scope = options.within ?? null;
  const testIdAttr = options.testIdAttribute ?? 'data-testid';

  // Everything below runs in the browser. It deliberately contains no named or
  // const-assigned functions: tsx/esbuild rewrites those with a `__name` helper
  // that does not exist in the page, and evaluate fails at runtime.
  const collected = await page.evaluate(
    ([testIdAttr, scope, stateAttributes]: [string, string | null, string[]]) => {
      const SELECTOR =
        'button, a[href], input, select, textarea, [role=button], [role=link], [role=tab], [role=checkbox], [role=switch], [role=menuitem], [contenteditable=true]';

      // Scrolling is needed to judge occlusion honestly (see below), so the
      // position is restored before returning — a read-only scan must not leave
      // the page somewhere the caller did not put it.
      const scrolledFrom = { x: window.scrollX, y: window.scrollY };

      const forms = Array.from(document.querySelectorAll('form'));

      // Frames are a blind spot, not an absence. querySelectorAll never crosses
      // into them, so an app that iframes its real content would otherwise be
      // reported as a nearly empty page — a wrong answer stated confidently.
      const frames = Array.from(document.querySelectorAll('iframe, frame')).map(
        (frame) => frame.getAttribute('src') ?? '(no src)',
      );

      // querySelectorAll does not descend into a shadow root, so a Web Components
      // app looks like an empty page. Declaring that as a blind spot was honest and
      // useless: the Polymer shop reported zero interactive elements while being a
      // working storefront. So walk the open roots.
      //
      // Iterative rather than recursive on purpose — a named helper here would be
      // rewritten to call the __name shim that does not exist in page context.
      const shadowHosts: string[] = [];
      const searchRoots: (Document | ShadowRoot | Element)[] = [
        scope === null ? document : (document.querySelector(scope) ?? document),
      ];
      const collected: Element[] = [];

      for (let index = 0; index < searchRoots.length; index += 1) {
        const root = searchRoots[index];
        if (root === undefined) continue;

        for (const el of Array.from(root.querySelectorAll(SELECTOR))) collected.push(el);

        for (const el of Array.from(root.querySelectorAll('*'))) {
          if (el.shadowRoot !== null) {
            shadowHosts.push(el.tagName.toLowerCase());
            searchRoots.push(el.shadowRoot);
          }
        }
      }

      const result = {
        title: document.title,
        forms: forms.length,
        frames,
        shadowHosts: [...new Set(shadowHosts)],
        tables: document.querySelectorAll('table').length,
        elements: collected
          .filter((el) => {
            if ((el as HTMLInputElement).type === 'hidden') return false;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return false;
            const style = getComputedStyle(el);
            return style.visibility !== 'hidden' && style.display !== 'none';
          })
          .map((el) => {
            // Two separate casts rather than an intersection: intersecting the
            // two narrows `type` to the select-only union and the input checks
            // below stop compiling.
            const input = el as HTMLInputElement;
            const select = el as HTMLSelectElement;
            const isFormField =
              el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA';

            const state: Record<string, string> = {};
            for (const attribute of stateAttributes) {
              const value = el.getAttribute(attribute);
              if (value !== null) state[attribute] = value;
            }
            // Checkedness is a property, not only an attribute: a checkbox the
            // user has clicked reports checked=true with no attribute present.
            if (isFormField && (input.type === 'checkbox' || input.type === 'radio')) {
              state['checked'] = String(input.checked);
            }

            const owningForm = el.closest('form');

            // Can it actually be acted on? Identifying an element is only half of
            // testability; a control that is covered, off-screen or disabled is
            // addressable and still unusable.
            let blocker: string | null = null;

            // Ask the question in the layout the click will actually happen in.
            //
            // Playwright scrolls an element into view before acting on it, so
            // hit-testing the page where it happens to be sitting answers about a
            // moment that never occurs. Against a real site that produced two
            // confident "covered by <section>" findings for links a trial click
            // opens without complaint. The reasoning was already written down one
            // branch above — being below the fold is not a blocker, because
            // Playwright scrolls first — and simply had not been carried across to
            // occlusion.
            el.scrollIntoView({ block: 'center', inline: 'center' });

            const rect = el.getBoundingClientRect();
            const centreX = rect.left + rect.width / 2;
            const centreY = rect.top + rect.height / 2;
            // elementFromPoint only answers for points inside the viewport, and an
            // element taller than the viewport still has its centre outside it even
            // after scrolling. Clamping onto the edge samples something else
            // entirely, so occlusion is only judged where it can be observed.
            const centreInView =
              centreX >= 0 && centreX < window.innerWidth && centreY >= 0 && centreY < innerHeight;

            if (input.disabled === true) {
              blocker = 'disabled';
            } else if (isFormField && input.readOnly === true) {
              blocker = 'readonly';
            } else if (centreInView) {
              // Whatever the browser would actually hand the click to. If that is
              // not this element or something inside it, a real click lands on an
              // overlay instead — the classic "cookie banner ate the test".
              //
              // elementFromPoint stops at a shadow host, so on a Web Components app
              // every control reported as "covered by" its own container. Descend
              // through each root at the same point to reach what is really on top.
              let atPoint = document.elementFromPoint(centreX, centreY);
              while (atPoint !== null && atPoint.shadowRoot !== null) {
                const deeper = atPoint.shadowRoot.elementFromPoint(centreX, centreY);
                if (deeper === null || deeper === atPoint) break;
                atPoint = deeper;
              }

              if (atPoint !== null && atPoint !== el && !el.contains(atPoint)) {
                const covering = atPoint.tagName.toLowerCase();
                const coveringId = atPoint.getAttribute('id');
                blocker = `covered by <${covering}${coveringId === null ? '' : `#${coveringId}`}>`;
              }
            }

            return {
              blocker,
              tag: el.tagName.toLowerCase(),
              type: el.getAttribute('type'),
              role: el.getAttribute('role'),
              id: el.getAttribute('id'),
              testId: el.getAttribute(testIdAttr),
              ariaLabel: el.getAttribute('aria-label'),
              labelledByText: el.getAttribute('aria-labelledby')
                ? (document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent ??
                  null)
                : null,
              labelText: el.getAttribute('id')
                ? (document.querySelector(`label[for="${CSS.escape(el.getAttribute('id') ?? '')}"]`)
                    ?.textContent ?? null)
                : null,
              text: (el as HTMLElement).innerText ?? null,
              // An icon button or a logo link has no text of its own; the alt of
              // the image inside it is what names it.
              imageAlt: Array.from(el.querySelectorAll('img[alt]'))
                .map((image) => image.getAttribute('alt') ?? '')
                .filter((alt) => alt !== '')
                .join(' '),
              // input[type=submit] is labelled by its value, not by any text.
              value:
                el.tagName === 'INPUT' && (input.type === 'submit' || input.type === 'button')
                  ? (el.getAttribute('value') ?? null)
                  : null,
              title: el.getAttribute('title'),
              placeholder: el.getAttribute('placeholder'),
              stateAttributes: state,
              formIndex: owningForm === null ? null : forms.indexOf(owningForm),
              constraints: isFormField
                ? {
                    name: el.getAttribute('name'),
                    required: el.hasAttribute('required'),
                    disabled: input.disabled === true,
                    readOnly: input.readOnly === true,
                    value: (input.value ?? '').slice(0, 80),
                    min: el.getAttribute('min'),
                    max: el.getAttribute('max'),
                    step: el.getAttribute('step'),
                    pattern: el.getAttribute('pattern'),
                    maxLength:
                      input.maxLength !== undefined && input.maxLength >= 0
                        ? input.maxLength
                        : null,
                    options:
                      el.tagName === 'SELECT'
                        ? Array.from(select.options ?? [])
                            .slice(0, 25)
                            .map((option) => option.value)
                        : [],
                  }
                : null,
            };
          }),
      };

      window.scrollTo(scrolledFrom.x, scrolledFrom.y);
      return result;
    },
    [testIdAttr, scope, STATE_ATTRIBUTES] as [string, string | null, string[]],
  );

  const partial = collected.elements.map((raw) => {
    const accessible = accessibleNameFrom(raw satisfies NameParts);

    // Framework-generated ids (React's :r0:, Ember, ExtJS) change between builds,
    // so they are no better than a positional selector.
    const hasStableId =
      raw.id !== null && raw.id !== '' && !/^[0-9]|:r[0-9a-z]+:|^ember|^ext-gen/i.test(raw.id);

    const role = raw.role ?? defaultRole(raw.tag, raw.type);

    let suggested: string;
    let stability: ScannedElement['stability'];

    if (raw.testId) {
      suggested = `getByTestId('${raw.testId}')`;
      stability = 'stable';
    } else if (hasStableId && raw.id) {
      // A hand-written id is not a test id, but it is not positional either, and
      // in most codebases it is the best hook that actually exists.
      suggested = `locator('#${raw.id}')`;
      stability = 'stable';
    } else if (accessible) {
      suggested = role
        ? `getByRole('${role}', { name: ${JSON.stringify(accessible)} })`
        : `getByText(${JSON.stringify(accessible)})`;
      stability = 'text-dependent';
    } else {
      suggested = `locator('${raw.tag}')`;
      stability = 'fragile';
    }

    return {
      raw,
      element: {
        tag: raw.tag,
        type: raw.type,
        role: raw.role,
        accessibleName: accessible,
        testId: raw.testId,
        affordance: affordanceOf(raw.tag, raw.type, role, accessible),
        suggested,
        unique: true,
        stability,
        constraints: raw.constraints,
        stateAttributes: raw.stateAttributes,
        formIndex: raw.formIndex,
        blocker: raw.blocker,
      } satisfies ScannedElement,
    };
  });

  const interactive = markUniqueness(partial.map(({ element }) => element));

  return {
    url: page.url(),
    title: collected.title,
    scannedAt: new Date().toISOString(),
    counts: {
      interactive: interactive.length,
      inputs: interactive.filter((el) => el.affordance === 'input').length,
      submits: interactive.filter((el) => el.affordance === 'submit').length,
      stateful: interactive.filter((el) => Object.keys(el.stateAttributes).length > 0).length,
      blocked: interactive.filter((el) => el.blocker !== null).length,
      withTestId: interactive.filter((el) => el.testId !== null).length,
      forms: collected.forms,
      tables: collected.tables,
    },
    frames: collected.frames,
    shadowHosts: collected.shadowHosts,
    interactive,
    endpoints: [],
    testability: auditTestability(interactive, collected.frames, collected.shadowHosts),
  };
}

/**
 * Flags every element whose suggested selector is shared with another.
 *
 * Ambiguity is the failure people actually hit: two controls with the same role
 * and name make `getByRole` throw a strict-mode violation at runtime, test ids or
 * not. Pure and exported so it can be unit-tested — it lived inside `scanPage`
 * until a surviving mutation showed that blanking it left the suite green,
 * because the only test covering it needed a browser and the mutation runner does
 * not start one.
 */
export function markUniqueness<T extends { suggested: string }>(
  elements: T[],
): (T & { unique: boolean })[] {
  const occurrences = new Map<string, number>();
  for (const element of elements) {
    occurrences.set(element.suggested, (occurrences.get(element.suggested) ?? 0) + 1);
  }
  return elements.map((element) => ({
    ...element,
    unique: (occurrences.get(element.suggested) ?? 0) === 1,
  }));
}

function affordanceOf(
  tag: string,
  type: string | null,
  role: string | null,
  name: string | null,
): Affordance {
  if (tag === 'a') return 'navigation';
  if (type === 'submit' || (tag === 'button' && (type === null || type === 'submit'))) {
    // A <button> with no type inside a form submits it, which is the single most
    // consequential default in HTML and the one a policy needs to know about.
    if (type === 'submit') return 'submit';
  }
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    if (type === 'checkbox' || type === 'radio') return 'toggle';
    if (type === 'submit' || type === 'button') return 'submit';
    return 'input';
  }
  if (role === 'checkbox' || role === 'switch' || role === 'tab') return 'toggle';
  if (name !== null && TOGGLE_WORDS.some((word) => name.toLowerCase().includes(word))) {
    return 'toggle';
  }
  return 'control';
}

/**
 * The role a tag implies when the markup does not say one.
 *
 * Exported because the healer needs the same answer: comparing the raw `role`
 * attribute would leave the signal uncomparable on the great majority of pages,
 * which write no roles at all.
 */
export function defaultRole(tag: string, type: string | null): string | null {
  if (tag === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'select') return 'combobox';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'input') {
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'submit' || type === 'button') return 'button';
    return 'textbox';
  }
  return null;
}

/**
 * Findings a QE would actually raise. Note what is *not* here: "this element has
 * no test id". That is the normal state of most applications and is not, by
 * itself, a problem worth anyone's attention.
 */
export function auditTestability(
  elements: ScannedElement[],
  frames: string[] = [],
  shadowHosts: string[] = [],
): TestabilityIssue[] {
  const issues: TestabilityIssue[] = [];

  // Frames still bound everything below them. Shadow roots no longer do: open
  // roots are walked, so their controls appear in the inventory above rather than
  // as a caveat. A *closed* root cannot be detected at all, let alone entered,
  // which is a limit worth knowing but not one we can report per element.
  for (const src of frames) {
    issues.push({
      severity: 'medium',
      kind: 'unscanned-frame',
      element: `<iframe src="${src}">`,
      problem:
        'This scan does not cross into frames, so anything inside it is unexamined. A clean result above says nothing about this content.',
      suggestion:
        'Scan the frame URL directly, or use frameLocator() in tests and treat this area as uncovered until then.',
    });
  }

  // Open shadow roots are walked, so their controls are in the inventory rather
  // than behind a caveat, and `shadowHosts` is now a fact about the page's
  // construction instead of a finding. It stays in the scan output because it
  // changes how selectors behave: hand-written CSS descendant chains do not cross
  // a shadow boundary even though Playwright's own engines do.
  void shadowHosts;

  for (const el of elements) {
    const describe = `<${el.tag}${el.type === null ? '' : ` type=${el.type}`}>${
      el.accessibleName === null ? '' : ` "${el.accessibleName}"`
    }`;

    // Order matters. A nameless control that is also duplicated is duplicated
    // *because* it is nameless, so the actionable finding is the missing name.
    // Ambiguity is reported for elements that do have a name and still collide.
    if (el.stability === 'fragile' && el.affordance !== 'input') {
      issues.push({
        severity: 'high',
        kind: 'unaddressable',
        element: describe,
        problem: 'No accessible name, no id and no test id — only reachable by position.',
        suggestion: 'Give it an accessible name (aria-label, or real label text).',
      });
      continue;
    }

    if (!el.unique) {
      issues.push({
        severity: 'high',
        kind: 'ambiguous',
        element: describe,
        problem: `More than one element matches ${el.suggested}. A test using it fails on strict-mode violation, not on the behaviour it meant to check.`,
        suggestion:
          'Disambiguate by scoping to a container, or give this one a distinguishing name.',
      });
      continue;
    }

    // Before the generic case: an unlabelled input is always also positionally
    // addressed, so the generic branch would swallow it and the more specific,
    // more actionable finding would never be reachable.
    if (el.affordance === 'input' && el.accessibleName === null) {
      issues.push({
        severity: 'high',
        kind: 'unlabelled-input',
        element: describe,
        problem: 'An input with no label cannot be filled reliably, nor read by anyone using AT.',
        suggestion:
          'Associate a <label for="...">, or add aria-label, so the field is addressable and announced.',
      });
      continue;
    }

    if (el.stability === 'fragile') {
      issues.push({
        severity: 'high',
        kind: 'unaddressable',
        element: describe,
        problem: 'No accessible name, no id and no test id — only reachable by position.',
        suggestion: 'Give it an accessible name (aria-label, or real label text).',
      });
      continue;
    }

    // The interact half of the definition. `disabled` and `readonly` are usually
    // deliberate product states rather than defects, so only the cases that
    // genuinely surprise a test author are raised.
    if (el.blocker !== null && el.blocker !== 'disabled' && el.blocker !== 'readonly') {
      issues.push({
        severity: 'high',
        kind: 'unreachable',
        element: describe,
        problem: `Addressable but not actionable: ${el.blocker}. A click resolves to something else, so the test fails somewhere far from the cause.`,
        suggestion:
          'Dismiss or scope out the overlay, scroll it into view first, or fix the stacking so the control receives its own clicks.',
      });
      continue;
    }

    if (el.affordance === 'toggle' && Object.keys(el.stateAttributes).length === 0) {
      issues.push({
        severity: 'medium',
        kind: 'no-observable-state',
        element: describe,
        problem:
          'This control changes state but exposes none: no aria-pressed, aria-expanded, aria-checked or equivalent. You can act on it and cannot assert the result.',
        suggestion:
          'Expose the state with the matching ARIA attribute, so the outcome is observable rather than inferred from styling.',
      });
    }
  }

  return issues;
}

export function formatScan(scan: PageScan): string {
  const { counts } = scan;
  const lines = [
    `${scan.title}`,
    `${scan.url}`,
    '',
    `Interactive: ${counts.interactive}  (${counts.inputs} input, ${counts.submits} submit, ${counts.stateful} expose state, ${counts.blocked} blocked)`,
    `Forms: ${counts.forms}   Tables: ${counts.tables}   Test ids: ${counts.withTestId}`,
    '',
  ];

  if (scan.frames.length > 0) {
    lines.push(
      `Frames: ${scan.frames.length} NOT scanned — content inside is unexamined:`,
      ...scan.frames.map((src) => `  ${src}`),
      '',
    );
  }

  if (scan.shadowHosts.length > 0) {
    lines.push(
      `Shadow roots: ${scan.shadowHosts.length} open host(s), walked — their controls are included above:`,
      ...scan.shadowHosts.map((host) => `  <${host}>`),
      '  A hand-written CSS descendant chain will not cross these boundaries, though',
      "  Playwright's own selector engines do. A closed root cannot be detected at all.",
      '',
    );
  }

  const ambiguous = scan.interactive.filter((el) => !el.unique).length;
  const byStability = { stable: 0, 'text-dependent': 0, fragile: 0 };
  for (const el of scan.interactive) byStability[el.stability] += 1;
  lines.push(
    `Addressability: ${byStability.stable} stable, ${byStability['text-dependent']} by name, ${byStability.fragile} positional, ${ambiguous} ambiguous`,
    '',
  );

  const inputs = scan.interactive.filter((el) => el.constraints !== null);
  if (inputs.length > 0) {
    lines.push('Inputs — the surface a boundary probe works on:');
    for (const el of inputs.slice(0, 20)) {
      const c = el.constraints;
      if (c === null) continue;
      const bounds = [
        c.required ? 'required' : null,
        c.min === null ? null : `min=${c.min}`,
        c.max === null ? null : `max=${c.max}`,
        c.maxLength === null ? null : `maxlength=${c.maxLength}`,
        c.pattern === null ? null : `pattern=${c.pattern}`,
        c.disabled ? 'disabled' : null,
        c.readOnly ? 'readonly' : null,
        c.options.length > 0 ? `options=${c.options.length}` : null,
      ]
        .filter((entry) => entry !== null)
        .join(' ');
      const label = el.accessibleName ?? c.name ?? '(unlabelled)';
      lines.push(
        `  ${el.suggested}  "${label}"${bounds === '' ? '' : `  [${bounds}]`}${
          c.value === '' || c.value === null ? '' : `  = ${c.value}`
        }`,
      );
    }
    lines.push('');
  }

  const stateful = scan.interactive.filter((el) => Object.keys(el.stateAttributes).length > 0);
  if (stateful.length > 0) {
    lines.push('Observable state — what an interaction can be asserted against:');
    for (const el of stateful.slice(0, 20)) {
      const pairs = Object.entries(el.stateAttributes)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      lines.push(`  ${el.accessibleName ?? el.suggested}  ${pairs}`);
    }
    lines.push('');
  }

  if (scan.testability.length > 0) {
    lines.push('Testability findings:');
    for (const issue of scan.testability.slice(0, 20)) {
      lines.push(`  [${issue.severity}] ${issue.kind}  ${issue.element}`, `      ${issue.problem}`);
    }
    if (scan.testability.length > 20) {
      lines.push(`  ... and ${scan.testability.length - 20} more`);
    }
  } else {
    lines.push('Testability findings: none — every control is uniquely addressable.');
  }

  return lines.join('\n').trimEnd();
}
