import { test, expect } from '../../src/fixtures/harness.js';
import { formatScan, scanPage } from '../../src/tools/page-scanner.js';
import { probePage } from '../../src/tools/probe.js';

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

test.describe('judging whether a control can actually be clicked', () => {
  test('should not call a control covered only at rest blocked, because Playwright scrolls first', async ({
    page,
  }) => {
    // The exact shape that produced two confident false positives against a real
    // site: a sticky header, and a control sitting under it at the page's current
    // scroll position. Playwright scrolls an element into view before acting, so
    // hit-testing where it happens to be sitting answers about a moment that never
    // occurs.
    await page.setContent(`
      <style>
        header { position: sticky; top: 0; height: 100px; background: #333; }
        body { margin: 0; height: 4000px; }
        #target { position: absolute; top: 2000px; }
      </style>
      <header>Site header</header>
      <a id="target" href="/somewhere">Chapter 3</a>
    `);
    await page.evaluate(() => window.scrollTo(0, 1960));

    const scan = await scanPage(page);
    const target = scan.interactive.find((el) => el.accessibleName === 'Chapter 3');

    expect(
      target?.blocker,
      'a trial click on this succeeds, so reporting it as covered sends someone hunting for an overlay that is not there',
    ).toBeNull();
  });

  test('should still report a control a fixed overlay genuinely covers', async ({ page }) => {
    // The other direction, and the reason the check exists at all. A detector that
    // stops crying wolf by never barking is not an improvement.
    await page.setContent(`
      <style>
        #consent { position: fixed; inset: 0; background: rgba(0,0,0,.6); }
        body { margin: 0; height: 4000px; }
        #target { position: absolute; top: 2000px; }
      </style>
      <a id="target" href="/somewhere">Accept terms</a>
      <div id="consent">Cookies?</div>
    `);

    const scan = await scanPage(page);
    const target = scan.interactive.find((el) => el.accessibleName === 'Accept terms');

    expect(target?.blocker, 'the cookie banner really does eat the click').toContain('covered by');
  });

  test('should leave the page at the scroll position it found it', async ({ page }) => {
    await page.setContent(`
      <style>body { margin: 0; height: 4000px; }</style>
      <a href="/a" style="position:absolute;top:3000px">Deep link</a>
    `);
    await page.evaluate(() => window.scrollTo(0, 500));

    await scanPage(page);

    expect(
      await page.evaluate(() => window.scrollY),
      'a read-only scan must not leave the page somewhere the caller did not put it — the next pass measures from wherever this one stopped',
    ).toBe(500);
  });
});

test.describe('naming a control that has no text of its own', () => {
  test('should name an image-only link by the alt of its image', async ({ page }) => {
    // Logos, icon buttons, product tiles and social links are all this shape. The
    // accessible-name spec says the image's alt names the link, and every browser
    // and Playwright's getByRole agree — so calling it unaddressable was wrong
    // about a whole category of perfectly targetable controls.
    await page.setContent(`<a href="/report"><img src="x.png" alt="Download report"></a>`);

    const scan = await scanPage(page);

    expect(scan.interactive[0]?.accessibleName).toBe('Download report');
    expect(
      scan.testability.filter((issue) => issue.kind === 'unaddressable'),
      'it has a name, so there is nothing to report',
    ).toHaveLength(0);
  });

  test('should still report an image-only link whose alt is empty', async ({ page }) => {
    // alt="" means "decorative, skip me". On a link whose only content is that
    // image, it leaves the link with no name at all — which is the real finding.
    await page.setContent(`<a href="/"><img src="logo.png" alt=""></a>`);

    const scan = await scanPage(page);

    expect(scan.interactive[0]?.accessibleName).toBeNull();
    expect(
      scan.testability.some((issue) => issue.kind === 'unaddressable'),
      'a link a screen reader announces as bare "link" is both an accessibility defect and untargetable',
    ).toBe(true);
  });

  test('should name a submit input by its value', async ({ page }) => {
    await page.setContent(`<form><input type="submit" value="Place order"></form>`);

    const scan = await scanPage(page);

    expect(
      scan.interactive[0]?.accessibleName,
      'input[type=submit] has no text content; its value is its label',
    ).toBe('Place order');
  });
});

test.describe('separating the map from the findings', () => {
  test('should file a covered control as a product defect, not only an automation problem', async ({
    page,
  }) => {
    // The whole reason for the split. A control nobody can click is a defect in
    // the product; it used to be reported only as a "testability finding", which
    // is why the first exploratory session read it as trivia about selectors.
    await page.setContent(`
      <style>#banner { position: fixed; inset: 0; background: rgba(0,0,0,.6); }</style>
      <button id="buy">Buy now</button>
      <div id="banner">Cookies?</div>
    `);

    const scan = await scanPage(page);
    const covered = scan.testability.find((issue) => issue.kind === 'unreachable');

    expect(
      covered?.audience,
      'a user cannot click it either, so the product owner needs this as much as the automator does',
    ).toEqual(['product', 'automation']);
  });

  test('should keep an ambiguous selector out of the product findings', async ({ page }) => {
    // The other direction: a person looking at two Edit buttons knows which one
    // they mean. Strict mode does not. That is an automation problem only, and
    // putting it in front of a product owner is noise.
    await page.setContent(`
      <table>
        <tr><td>One</td><td><button>Edit</button></td></tr>
        <tr><td>Two</td><td><button>Edit</button></td></tr>
      </table>
    `);

    const scan = await scanPage(page);
    const ambiguous = scan.testability.filter((issue) => issue.kind === 'ambiguous');

    expect(ambiguous.length).toBeGreaterThan(0);
    for (const issue of ambiguous) {
      expect(issue.audience, 'ambiguity costs the automator, not the user').toEqual(['automation']);
    }

    const report = formatScan(scan);
    const productSection = report.slice(
      report.indexOf('PRODUCT FINDINGS'),
      report.indexOf('AUTOMATION READINESS'),
    );
    expect(
      productSection,
      'the product section must stay readable by someone who does not care about selectors',
    ).not.toContain('ambiguous');
  });

  test('should declare a frame as a blind spot rather than a finding', async ({ page }) => {
    await page.setContent(`<iframe src="/inner.html"></iframe><button>Outside</button>`);

    const scan = await scanPage(page);
    const frame = scan.testability.find((issue) => issue.kind === 'unscanned-frame');

    expect(
      frame?.audience,
      'an unscanned frame is the map admitting what it could not see — it is neither a defect nor a selector problem',
    ).toEqual(['recon']);

    const report = formatScan(scan);
    expect(report).toContain('Blind spot:');
    expect(
      report.indexOf('Blind spot:'),
      'blind spots belong to the map, so they must appear before the findings',
    ).toBeLessThan(report.indexOf('PRODUCT FINDINGS'));
  });

  test('should order the three reports map, product, automation', async ({ page }) => {
    await page.setContent(`<button>Go</button>`);
    const report = formatScan(await scanPage(page));

    expect(report.indexOf('THE MAP')).toBeLessThan(report.indexOf('PRODUCT FINDINGS'));
    expect(
      report.indexOf('PRODUCT FINDINGS'),
      'automation readiness is written last, and only about what turned out worth keeping',
    ).toBeLessThan(report.indexOf('AUTOMATION READINESS'));
  });
});

test.describe('how complete the map admits to being', () => {
  test('should include an input that only arrives after load', async ({ page, network }) => {
    // The defect this closes. A real cart rendered its quantity field — declaring
    // min=1 max=10 — after load, the probe only settled for SPA-ish pages, and the
    // page was classified `enhanced`. So a boundary the page had written down never
    // reached the map, and the technique that would have used it had nothing to read.
    await page.setContent(`
      <p>Server-rendered body</p>
      <script>
        setTimeout(() => {
          const input = document.createElement('input');
          input.type = 'number';
          input.id = 'qty';
          input.min = '1';
          input.max = '10';
          document.body.appendChild(input);
        }, 400);
      </script>
    `);

    const result = await probePage(page, network);
    const late = result.scan.interactive.find((el) => el.suggested.includes('qty'));

    expect(
      result.settled,
      'the map reports how complete it is, and a page that did settle must not be reported as a floor',
    ).toBe('settled');
    expect(late, 'an input that arrives late is still an input').toBeDefined();
    expect(
      late?.constraints?.max,
      'the bound is the whole point — a boundary probe has nothing to work from without it',
    ).toBe('10');
  });

  test('should declare the inventory a floor when the page never settled', async ({ page }) => {
    await page.setContent(`<button>Go</button>`);
    const report = formatScan(await scanPage(page), { settled: 'timed-out' });

    expect(
      report,
      'a short list that announces itself as short can be worked with; one that looks complete cannot',
    ).toContain('INVENTORY IS A FLOOR');
    expect(
      report.indexOf('INVENTORY IS A FLOOR'),
      'the caveat has to come before the counts it applies to',
    ).toBeLessThan(report.indexOf('Interactive:'));
  });

  test('should not warn when the page did settle', async ({ page }) => {
    await page.setContent(`<button>Go</button>`);
    const report = formatScan(await scanPage(page), { settled: 'settled' });

    expect(report, 'a caveat printed on every report is a caveat nobody reads').not.toContain(
      'INVENTORY IS A FLOOR',
    );
    expect(report).toContain('stopped adding to itself');
  });
});
