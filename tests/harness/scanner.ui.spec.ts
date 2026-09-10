import { test, expect } from '../../src/fixtures/harness.js';
import { scanPage } from '../../src/tools/page-scanner.js';

/**
 * Scanner behaviour that only a real DOM can prove.
 *
 * The unit tests feed `auditTestability` a hand-built element list, which checks
 * the findings but never the measurements they rest on. A surviving mutation
 * showed the difference: blanking the uniqueness calculation entirely left the
 * whole suite green, because nothing exercised it against real markup.
 */

test.describe('scanner measurements', () => {
  test('should mark controls sharing a role and name as not unique', async ({ page }) => {
    await page.setContent(`
      <table>
        <tr><td>Booking 1</td><td><button>Edit</button></td></tr>
        <tr><td>Booking 2</td><td><button>Edit</button></td></tr>
        <tr><td>Booking 3</td><td><button>Delete</button></td></tr>
      </table>
    `);

    const scan = await scanPage(page);
    const edits = scan.interactive.filter((el) => el.accessibleName === 'Edit');
    const del = scan.interactive.find((el) => el.accessibleName === 'Delete');

    expect(edits, 'both Edit buttons must appear in the inventory').toHaveLength(2);
    for (const edit of edits) {
      expect(
        edit.unique,
        'two buttons sharing a role and name make the selector ambiguous — a test using it fails on a strict-mode violation, not on behaviour',
      ).toBe(false);
    }
    expect(
      del?.unique,
      'the one control with a distinct name must still be reported as uniquely addressable',
    ).toBe(true);

    const ambiguous = scan.testability.filter((issue) => issue.kind === 'ambiguous');
    expect(
      ambiguous,
      'each ambiguous control must raise its own finding, since each is separately unusable',
    ).toHaveLength(2);
  });

  test('should read input constraints so a boundary probe has something to work from', async ({
    page,
  }) => {
    await page.setContent(`
      <label for="qty">Quantity</label>
      <input id="qty" name="quantity" type="number" min="1" max="99" step="1" required value="7">
    `);

    const scan = await scanPage(page);
    const qty = scan.interactive.find((el) => el.accessibleName === 'Quantity');

    expect(qty?.constraints?.min, 'the lower bound is the first probe worth running').toBe('1');
    expect(qty?.constraints?.max, 'the upper bound is the second').toBe('99');
    expect(qty?.constraints?.required, 'requiredness decides whether empty is a valid case').toBe(
      true,
    );
    expect(
      qty?.constraints?.value,
      'the current value is where a probe starts from, so it must be captured not guessed',
    ).toBe('7');
  });

  test('should record the attributes that make an outcome assertable', async ({ page }) => {
    await page.setContent(`
      <button id="a" aria-expanded="false">Show details</button>
      <button id="b">Show more</button>
    `);

    const scan = await scanPage(page);
    const withState = scan.interactive.find((el) => el.accessibleName === 'Show details');
    const without = scan.interactive.find((el) => el.accessibleName === 'Show more');

    expect(
      withState?.stateAttributes['aria-expanded'],
      'an exposed state is what a test asserts against after interacting',
    ).toBe('false');
    expect(
      Object.keys(without?.stateAttributes ?? {}),
      'a control exposing nothing must be recorded as exposing nothing, not given a default',
    ).toEqual([]);

    const unobservable = scan.testability.filter((issue) => issue.kind === 'no-observable-state');
    expect(
      unobservable,
      'only the toggle with no state may be flagged — flagging the well-behaved one would make the rule noise',
    ).toHaveLength(1);
  });

  test('should declare a frame rather than reporting the page as fully scanned', async ({
    page,
  }) => {
    await page.setContent(`
      <button>Outside</button>
      <iframe src="/embedded/widget"></iframe>
    `);

    const scan = await scanPage(page);

    expect(scan.frames, 'the frame source must be recorded so the gap is nameable').toEqual([
      '/embedded/widget',
    ]);
    expect(
      scan.testability.some((issue) => issue.kind === 'unscanned-frame'),
      'the scan cannot see inside a frame, and silence about that reads as coverage',
    ).toBe(true);
  });
});
