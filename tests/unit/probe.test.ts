import { test, expect } from '@playwright/test';
import { deepPassDefects } from '../../src/tools/probe.js';
import type { ZoomResult } from '../../src/tools/reveal.js';

function zoom(over: Partial<ZoomResult> = {}): ZoomResult {
  return { percent: 200, horizontalOverflow: false, overflowPx: 0, lost: [], tiny: [], ...over };
}

/**
 * A reflow failure is a defect in the product, not a fact about the play area.
 *
 * It used to be printed inside a section headed "What a static scan cannot see",
 * where a reader took it for trivia about selectors — which is exactly what
 * happened during the first exploratory session run with this harness.
 */
test.describe('defects the deep passes find', () => {
  test('should report a reflow failure as a product defect, with the standard named', () => {
    const found = deepPassDefects(zoom({ horizontalOverflow: true, overflowPx: 1250 })).join('\n');

    expect(found, 'the number is what makes it arguable with a developer').toContain('1250px');
    expect(
      found,
      'a defect with a standard behind it is far easier to get fixed than an opinion',
    ).toContain('WCAG 1.4.10');
  });

  test('should report a click target below the minimum size', () => {
    const found = deepPassDefects(zoom({ tiny: ['Skip to content'] })).join('\n');
    expect(
      found,
      'the control has to be named, or nobody can tell which one is too small',
    ).toContain('Skip to content');
    expect(found).toContain('WCAG 2.5.8');
  });

  test('should report a control that disappears when zoomed', () => {
    const found = deepPassDefects(zoom({ lost: ['Checkout'] })).join('\n');
    expect(found, 'a control you cannot see at 200% is unusable, not merely awkward').toContain(
      'lost-at-zoom',
    );
  });

  test('should say nothing when the page reflows cleanly', () => {
    expect(
      deepPassDefects(zoom()),
      'a pass that always finds something is a pass nobody reads',
    ).toEqual([]);
  });

  test('should say nothing when the zoom pass did not run', () => {
    expect(deepPassDefects(null)).toEqual([]);
  });
});
