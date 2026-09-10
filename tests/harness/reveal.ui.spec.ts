import { test, expect } from '../../src/fixtures/harness.js';
import {
  detectHoverReveals,
  detectKeyboardProfile,
  detectLateArrivals,
  detectResponsiveDiff,
  detectScrollReveals,
  detectZoomReflow,
} from '../../src/tools/reveal.js';

/**
 * The six passes that find what a snapshot cannot.
 *
 * Each is tested in both directions, because every one of these is a detector and
 * a detector that cries wolf is worse than none — a lesson this repo learned twice
 * the expensive way. Fixtures are built with `setContent` so the expected answer
 * is known exactly, rather than inferred from a live site that can change.
 */

test.describe('hover', () => {
  test('should find a control that only exists while something is hovered', async ({ page }) => {
    await page.setContent(`
      <style>
        .card .actions { display: none; }
        .card:hover .actions { display: block; }
      </style>
      <div class="card" style="width:200px;height:120px;background:#eee">
        Product
        <div class="actions"><button>Quick view</button></div>
      </div>
    `);

    const reveals = await detectHoverReveals(page, { settleMs: 80 });

    expect(
      reveals.flatMap((reveal) => reveal.revealed).join(' '),
      'a button behind a CSS hover rule is invisible to a snapshot and perfectly testable',
    ).toContain('Quick view');
  });

  test('should stay silent on a page that hides nothing', async ({ page }) => {
    await page.setContent('<button>Save</button><a href="/x">Home</a>');

    expect(
      await detectHoverReveals(page, { settleMs: 50 }),
      'reporting reveals on a static page would make the pass noise',
    ).toEqual([]);
  });
});

test.describe('keyboard', () => {
  test('should record tab order and find a control revealed only by focus', async ({ page }) => {
    await page.setContent(`
      <style>
        .skip { position: absolute; left: -9999px; }
        .skip:focus { left: 0; position: static; }
      </style>
      <a class="skip" href="#main">Skip to content</a>
      <button>First</button>
      <button>Second</button>
    `);

    const profile = await detectKeyboardProfile(page, { maxProbes: 6 });

    expect(
      profile.tabOrder.length,
      'a page with three focusable controls must produce more than one stop',
    ).toBeGreaterThan(1);
    expect(
      profile.focusReveals.join(' '),
      'a skip link exists only under focus — the classic control no other pass can see',
    ).toContain('Skip to content');
  });

  test('should report a control with no visible focus indicator', async ({ page }) => {
    await page.setContent(`
      <style>
        button { outline: none; border: none; box-shadow: none; }
      </style>
      <button>Invisible focus</button>
    `);

    const profile = await detectKeyboardProfile(page, { maxProbes: 3 });

    expect(
      profile.noFocusIndicator.join(' '),
      'reachable by keyboard with nothing observable marking arrival is a real testability gap',
    ).toContain('Invisible focus');
  });

  test('should not flag a control that does show focus', async ({ page }) => {
    await page.setContent(`
      <style> button:focus { outline: 3px solid blue; } </style>
      <button>Visible focus</button>
    `);

    const profile = await detectKeyboardProfile(page, { maxProbes: 3 });

    expect(
      profile.noFocusIndicator,
      'a properly focusable control must not be reported, or the finding becomes noise',
    ).toEqual([]);
  });
});

test.describe('responsive', () => {
  test('should report the parallel interface that only exists on a narrow viewport', async ({
    page,
  }) => {
    await page.setContent(`
      <style>
        .desktop-nav { display: block; }
        .burger { display: none; }
        @media (max-width: 500px) {
          .desktop-nav { display: none; }
          .burger { display: block; }
        }
      </style>
      <nav class="desktop-nav"><a href="/a">Catalogue</a><a href="/b">Offers</a></nav>
      <button class="burger">Menu</button>
    `);

    const diff = await detectResponsiveDiff(page, { width: 375, height: 812, settleMs: 200 });

    expect(diff, 'a page with a mobile breakpoint must produce a difference').not.toBeNull();
    expect(
      diff?.revealed.join(' '),
      'the hamburger is an entire navigation a desktop-only scan never reports',
    ).toContain('Menu');
    expect(
      diff?.hidden?.join(' '),
      'what disappears matters as much: those controls are untestable at this size',
    ).toContain('Catalogue');
  });

  test('should restore the original viewport afterwards', async ({ page }) => {
    const before = page.viewportSize();
    await page.setContent('<button>Only</button>');

    await detectResponsiveDiff(page, { width: 375, height: 812, settleMs: 100 });

    expect(
      page.viewportSize(),
      'leaving the page 375px wide would silently corrupt every measurement taken after it',
    ).toEqual(before);
  });
});

test.describe('late arrivals', () => {
  test('should name the controls that appear after the page looks settled', async ({ page }) => {
    await page.setContent(`
      <button>Immediate</button>
      <script>
        setTimeout(() => {
          const b = document.createElement('button');
          b.textContent = 'Arrived late';
          document.body.appendChild(b);
        }, 300);
      </script>
    `);

    const late = await detectLateArrivals(page, { waitMs: 900 });

    expect(
      late?.revealed.join(' '),
      'naming which controls arrive late is more useful than advising everyone to be careful',
    ).toContain('Arrived late');
  });

  test('should stay silent when nothing arrives late', async ({ page }) => {
    await page.setContent('<button>Static</button>');

    expect(
      await detectLateArrivals(page, { waitMs: 400 }),
      'a settled page must produce no finding, or the pass adds noise to every scan',
    ).toBeNull();
  });
});

test.describe('scroll', () => {
  test('should find lazily added controls and notice the page growing', async ({ page }) => {
    await page.setContent(`
      <div style="height:3000px">Long page</div>
      <script>
        let added = false;
        window.addEventListener('scroll', () => {
          if (added || window.scrollY < 200) return;
          added = true;
          const b = document.createElement('button');
          b.textContent = 'Load more';
          document.body.appendChild(b);
          document.body.appendChild(Object.assign(document.createElement('div'), {
            style: 'height:2000px',
          }));
        });
      </script>
    `);

    const result = await detectScrollReveals(page, { steps: 3, settleMs: 250 });

    expect(
      result.reveal?.revealed.join(' '),
      'infinite scroll and lazy loading are invisible at scroll position zero',
    ).toContain('Load more');
    expect(
      result.grew,
      'a page that grows while scrolling breaks any fixed-count assertion, so it must be reported',
    ).toBe(true);
  });
});

test.describe('zoom', () => {
  test('should report horizontal overflow at 200%', async ({ page }) => {
    await page.setContent(`
      <div style="width:1200px;background:#ccc">Fixed-width content that cannot reflow</div>
      <button>Act</button>
    `);

    const result = await detectZoomReflow(page, { percent: 200, settleMs: 150 });

    expect(
      result.horizontalOverflow,
      'fixed-width content forces sideways scrolling when magnified — WCAG 1.4.10',
    ).toBe(true);
    expect(
      result.overflowPx,
      'the report must quantify how far past the edge it runs',
    ).toBeGreaterThan(0);
  });

  test('should report a click target below the minimum size', async ({ page }) => {
    await page.setContent(
      '<button style="width:10px;height:10px;padding:0" aria-label="Tiny">x</button>',
    );

    const result = await detectZoomReflow(page, { percent: 200, settleMs: 100 });

    expect(
      result.tiny.join(' '),
      'a target under 24x24 is hard to hit for anyone, and trivially cheap to detect',
    ).toContain('Tiny');
  });

  test('should leave the page unzoomed afterwards', async ({ page }) => {
    await page.setContent('<button>Act</button>');

    await detectZoomReflow(page, { percent: 200, settleMs: 100 });

    expect(
      await page.evaluate(() => document.documentElement.style.zoom),
      'a page left zoomed would corrupt every measurement taken after it',
    ).toBe('');
  });
});
