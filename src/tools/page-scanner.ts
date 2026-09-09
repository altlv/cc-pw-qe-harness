import type { Page } from '@playwright/test';

export interface ScannedElement {
  tag: string;
  type: string | null;
  role: string | null;
  accessibleName: string | null;
  testId: string | null;
  /** Selector a generated test should use, best available. */
  suggested: string;
  /** How much a test built on `suggested` can be trusted. */
  stability: 'stable' | 'text-dependent' | 'fragile';
}

export interface TestabilityIssue {
  severity: 'high' | 'medium';
  element: string;
  problem: string;
  suggestion: string;
}

export interface PageScan {
  url: string;
  title: string;
  scannedAt: string;
  counts: { interactive: number; withTestId: number; forms: number; tables: number };
  interactive: ScannedElement[];
  endpoints: { method: string; path: string; status: number | null }[];
  testability: TestabilityIssue[];
}

/** Attribute the app uses for test ids; Playwright's default is data-testid. */
const TEST_ID_ATTR = 'data-testid';

/**
 * Inventories a page's interactive surface and grades how testable it is.
 *
 * This is the missing prerequisite for generating tests: without it an agent
 * invents selectors from a screenshot or from guesswork, which is how generated
 * suites end up full of `.btn:nth-child(3)`. Scan first, then generate against
 * facts.
 */
export async function scanPage(page: Page, options: { within?: string } = {}): Promise<PageScan> {
  const scope = options.within ?? null;

  // Everything below runs in the browser. It deliberately contains no named or
  // const-assigned functions: tsx/esbuild rewrites those with a `__name` helper
  // that does not exist in the page, and evaluate fails at runtime.
  const collected = await page.evaluate(
    ([testIdAttr, scope]: [string, string | null]) => {
      return {
        title: document.title,
        forms: document.querySelectorAll('form').length,
        tables: document.querySelectorAll('table').length,
        elements: Array.from(
          (scope === null
            ? document
            : (document.querySelector(scope) ?? document)
          ).querySelectorAll(
            'button, a[href], input, select, textarea, [role=button], [role=link], [role=tab], [role=checkbox], [contenteditable=true]',
          ),
        )
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return false;
            const style = getComputedStyle(el);
            return style.visibility !== 'hidden' && style.display !== 'none';
          })
          .map((el) => ({
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
            placeholder: el.getAttribute('placeholder'),
          })),
      };
    },
    [TEST_ID_ATTR, scope] as [string, string | null],
  );

  const interactive: ScannedElement[] = collected.elements.map((raw) => {
    const accessible =
      raw.ariaLabel?.trim() ||
      raw.labelledByText?.trim() ||
      raw.labelText?.trim() ||
      raw.text?.trim().slice(0, 80) ||
      raw.placeholder?.trim() ||
      null;

    // Framework-generated ids (React's :r0:, Ember, ExtJS) change between builds,
    // so they are no better than a positional selector.
    const hasStableId =
      raw.id !== null && raw.id !== '' && !/^[0-9]|:r[0-9a-z]+:|^ember|^ext-gen/i.test(raw.id);

    const el = { ...raw, accessibleName: accessible, hasStableId };

    let suggested: string;
    let stability: ScannedElement['stability'];

    if (el.testId) {
      suggested = `getByTestId('${el.testId}')`;
      stability = 'stable';
    } else if (el.hasStableId && el.id) {
      // A hand-written id is not a test id, but it is not positional either.
      suggested = `locator('#${el.id}')`;
      stability = 'stable';
    } else if (el.accessibleName) {
      const role = el.role ?? defaultRole(el.tag, el.type);
      suggested = role
        ? `getByRole('${role}', { name: ${JSON.stringify(el.accessibleName)} })`
        : `getByText(${JSON.stringify(el.accessibleName)})`;
      stability = 'text-dependent';
    } else {
      suggested = `locator('${el.tag}')`;
      stability = 'fragile';
    }

    return {
      tag: el.tag,
      type: el.type,
      role: el.role,
      accessibleName: el.accessibleName,
      testId: el.testId,
      suggested,
      stability,
    };
  });

  return {
    url: page.url(),
    title: collected.title,
    scannedAt: new Date().toISOString(),
    counts: {
      interactive: interactive.length,
      withTestId: interactive.filter((el) => el.testId !== null).length,
      forms: collected.forms,
      tables: collected.tables,
    },
    interactive,
    endpoints: [],
    testability: auditTestability(interactive),
  };
}

function defaultRole(tag: string, type: string | null): string | null {
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

/** Turns a scan into the testability findings a QE would raise with the team. */
export function auditTestability(elements: ScannedElement[]): TestabilityIssue[] {
  const issues: TestabilityIssue[] = [];

  for (const el of elements) {
    if (el.stability === 'fragile') {
      issues.push({
        severity: 'high',
        element: `<${el.tag}${el.type ? ` type=${el.type}` : ''}>`,
        problem: 'No test id, no id, and no accessible name — nothing stable to target.',
        suggestion: `Add ${TEST_ID_ATTR}, or an aria-label so the element is reachable by role.`,
      });
    } else if (el.stability === 'text-dependent') {
      issues.push({
        severity: 'medium',
        element: `<${el.tag}> "${el.accessibleName}"`,
        problem: 'Only targetable by visible text, so the test breaks on a copy or locale change.',
        suggestion: `Add ${TEST_ID_ATTR} to decouple the test from wording.`,
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
    `Interactive elements: ${counts.interactive} (${counts.withTestId} with ${TEST_ID_ATTR})`,
    `Forms: ${counts.forms}   Tables: ${counts.tables}`,
    '',
  ];

  const byStability = { stable: 0, 'text-dependent': 0, fragile: 0 };
  for (const el of scan.interactive) byStability[el.stability] += 1;
  lines.push(
    `Selector quality: ${byStability.stable} stable, ${byStability['text-dependent']} text-dependent, ${byStability.fragile} fragile`,
    '',
  );

  if (scan.testability.length > 0) {
    lines.push(`Testability findings (${scan.testability.length}):`);
    for (const issue of scan.testability.slice(0, 20)) {
      lines.push(`  [${issue.severity}] ${issue.element}`, `      ${issue.problem}`);
    }
    if (scan.testability.length > 20) {
      lines.push(`  … and ${scan.testability.length - 20} more`);
    }
  } else {
    lines.push('Testability findings: none — every element has a stable target.');
  }

  return lines.join('\n');
}
