import { test, expect } from '@playwright/test';
import {
  HealJournal,
  formatHeals,
  proposeSelector,
  type HealRecord,
  type HealStatus,
} from '../../src/tools/heal.js';
import type { Fingerprint } from '../../src/tools/identity.js';

function fingerprint(over: Partial<Fingerprint> = {}): Fingerprint {
  return {
    tag: 'button',
    role: 'button',
    name: 'Save',
    testId: null,
    fieldName: null,
    id: null,
    type: null,
    href: null,
    ancestors: ['html', 'body', 'form'],
    siblingIndex: 0,
    nearbyText: null,
    constraints: null,
    ...over,
  };
}

function record(status: HealStatus, over: Partial<HealRecord> = {}): HealRecord {
  return {
    selector: '#save',
    status,
    was: 'button "Save"',
    now: null,
    proposed: null,
    evidence: 'evidence',
    url: 'https://app.test/checkout',
    at: '2026-09-11T00:00:00.000Z',
    alternatives: [],
    ...over,
  };
}

test.describe('proposing a replacement selector', () => {
  test('should prefer a test id when the element has one', () => {
    expect(proposeSelector(fingerprint({ testId: 'save-button', id: 'save' }))).toBe(
      '[data-testid="save-button"]',
    );
  });

  test('should prefer the name attribute over the id', () => {
    // Deliberately the opposite of the scanner's ladder. A heal has just proved
    // this element's identity moved, so the question is which hook moves least
    // next: a field's name is a contract the server depends on, and an id is
    // decoration the next build can regenerate.
    expect(
      proposeSelector(fingerprint({ tag: 'input', fieldName: 'quantity', id: 'qty' })),
      'the name attribute outlives the id it sits beside',
    ).toBe('[name="quantity"]');
  });

  test('should not propose an id that the framework generated', () => {
    const generated = proposeSelector(fingerprint({ id: ':r7:' }));
    expect(
      generated,
      'a React-generated id identifies a render, not an element — proposing it hands the test a selector that is already stale',
    ).toBe('role=button[name="Save"]');
  });

  test('should fall back to text when there is no role', () => {
    expect(proposeSelector(fingerprint({ role: null, name: 'Save' }))).toBe('text="Save"');
  });

  test('should honour a custom test id attribute', () => {
    expect(proposeSelector(fingerprint({ testId: 'x' }), 'data-qa')).toBe('[data-qa="x"]');
  });
});

test.describe('the heal journal', () => {
  test('should count each outcome and separate what is not intact', () => {
    const journal = new HealJournal();
    journal.record(record('intact'));
    journal.record(record('intact'));
    journal.record(record('healed', { selector: '#a' }));
    journal.record(record('ambiguous', { selector: '#b' }));
    journal.record(record('lost', { selector: '#c' }));
    journal.record(record('wrong-page', { selector: '#d' }));

    const summary = journal.summarise();
    expect(summary.intact).toBe(2);
    expect(summary.healed).toBe(1);
    expect(summary.ambiguous).toBe(1);
    expect(summary.lost).toBe(1);
    expect(summary.wrongPage).toBe(1);
    expect(
      summary.notIntact.map((entry) => entry.selector),
      'everything that did not resolve as written has to reach the gate — an unreviewed heal in a green run is invisible',
    ).toEqual(['#a', '#b', '#c', '#d']);
  });
});

test.describe('reporting heals to a person', () => {
  test('should say plainly when nothing was healed', () => {
    expect(formatHeals([record('intact'), record('intact')])).toContain('Nothing was healed');
  });

  test('should show the proposed change and warn that a heal is not a fix', () => {
    const output = formatHeals([
      record('intact'),
      record('healed', {
        selector: '#save-a1b2',
        now: 'button "Save"',
        proposed: 'role=button[name="Save"]',
        evidence: 'score 0.72; agreed on roleAndName, name; differed on generatedId',
      }),
    ]);

    expect(output).toContain('#save-a1b2');
    expect(output, 'the evidence is what makes the proposal reviewable').toContain('roleAndName');
    expect(output, 'the replacement must be spelled out, not described').toContain(
      'role=button[name="Save"]',
    );
    expect(
      output,
      'without this the reader takes a heal for a fix, and the selector is never updated',
    ).toContain('proposal, not a fix');
  });

  test('should list the rivals when a heal was refused as too close to call', () => {
    const output = formatHeals([
      record('ambiguous', {
        alternatives: ['button "Edit" (0.72)', 'button "Edit" (0.72)'],
      }),
    ]);
    expect(
      output,
      'a bare refusal tells nobody what went wrong; the collision is the finding',
    ).toContain('button "Edit" (0.72)');
  });
});
