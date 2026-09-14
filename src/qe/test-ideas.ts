import type { PageScan, ScannedElement } from '../tools/page-scanner.js';
import type { EndpointShape, FieldShape } from '../tools/schema.js';
import { PROBES, boundaryValues, lengthBoundaries } from '../fixtures/probes.js';
import { gated, heuristic, inMode } from './heuristics.js';

/**
 * Concrete test cases derived from a saved scan, so a coder writes them instead of
 * working them out.
 *
 * Everything here reads something the scan already recorded: a declared bound, a
 * required flag, a select's options, a submit control, a toggle's state attribute, an
 * endpoint in the captured traffic. Nothing is guessed. When the scan cannot support a
 * generator, it says so in `notGenerated` instead of printing a thinner list that looks
 * complete.
 *
 * What stays out on purpose is listed in `heuristics.ts` as judgement: which risk
 * deserves the full probe set, what the rules and states mean, whether a result is
 * wrong. This module picks the values. It never decides a test is worth writing.
 */

/** The effect tags from `apps/app-config.ts`, held equal to them by a unit test. */
export type IdeaTag = '@read-only' | '@writes';

export interface TestIdea {
  /** Catalogue id in `heuristics.ts`. */
  heuristic: string;
  level: 'e2e' | 'api';
  /** A suggested selector from the scan, a group of controls, or `METHOD /path`. */
  target: string;
  /** False when the scan found the selector matching more than one element. */
  unique: boolean;
  /** Printable values: strings JSON-quoted, long repeats shown as the expression. */
  values: string[];
  /** The importable set these values come from, so a spec loops instead of retyping. */
  from: string | null;
  assert: string;
  /** Null leaves the test untagged, which runs it on local only. `untagged` says why. */
  tag: IdeaTag | null;
  untagged: string | null;
}

export interface IdeasInput {
  scan: PageScan;
  dictionary: EndpointShape[];
}

export interface Ideas {
  ideas: TestIdea[];
  /** What the scan could not support, stated rather than silently skipped. */
  notGenerated: string[];
}

/** How a value reads in a terminal: `'x'.repeat(1001)` rather than a thousand x's. */
export function display(value: string): string {
  const repeated = /^(.)\1{19,}(.*)$/su.exec(value);
  if (repeated !== null) {
    const [, char = '', rest = ''] = repeated;
    const count = value.length - rest.length;
    return `${JSON.stringify(char)}.repeat(${count})${rest === '' ? '' : ` + ${JSON.stringify(rest)}`}`;
  }
  return JSON.stringify(value);
}

const NEGATIVE_SET = [
  'missing required field',
  'invalid value',
  'invalid reference',
  'unauthenticated',
  'insufficient permission',
  'business-rule violation',
];

/**
 * A form with a password field authenticates. Typing probes into it and submitting is a
 * credential attempt, which the session rules allow on local only — lockouts on a
 * shared environment are real. Untagged is how a test says "local only".
 */
const AUTHENTICATES =
  'a credential attempt — leave it untagged so it runs on local only, where a lockout costs nobody';
const MAY_PERSIST = 'decide — a disclosure is client state, a toggle that saves a setting writes';

const TEXT_TYPES = new Set([null, 'text', 'search', 'url', 'tel']);
const DATE_TYPES = new Set(['date', 'datetime-local', 'time', 'month', 'week']);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface Effect {
  tag: IdeaTag | null;
  untagged: string | null;
}

function idea(
  id: string,
  element: ScannedElement,
  effect: Effect,
  fields: Pick<TestIdea, 'values' | 'from' | 'assert'>,
): TestIdea {
  return {
    heuristic: id,
    level: 'e2e',
    target: element.suggested,
    unique: element.unique,
    ...fields,
    ...effect,
  };
}

function fieldIdeas(element: ScannedElement, effect: Effect): TestIdea[] {
  const constraints = element.constraints;
  if (constraints === null) return [];
  const ideas: TestIdea[] = [];
  const type = element.tag === 'textarea' ? 'text' : element.type;

  if (constraints.required) {
    ideas.push(
      idea('partition-required', element, effect, {
        values: PROBES.required.map(display),
        from: 'PROBES.required',
        assert: 'refused with a message that names the field, and no write reaches the network',
      }),
    );
  }

  if (element.tag === 'select') {
    const options = constraints.options;
    const sampled =
      options.length <= 8
        ? options
        : [options[0], options[Math.floor(options.length / 2)], options.at(-1)].filter(
            (option): option is string => option !== undefined,
          );
    if (sampled.length > 0) {
      ideas.push(
        idea('partition-options', element, effect, {
          values: sampled.map(display),
          from: null,
          assert:
            options.length <= 8
              ? 'each option is reflected in what is shown or sent; reselecting the placeholder after a choice is handled'
              : `each is reflected in what is shown or sent. A sample of ${options.length} options (first, middle, last) — widen it if the options are not one class`,
        }),
      );
    }
    return ideas;
  }

  // An agent never types a real password, and a list of guesses is not a test design.
  if (type === 'password') return ideas;

  const bounds = boundaryValues(constraints.min, constraints.max, constraints.step);
  if (bounds.length > 0) {
    ideas.push(
      idea('boundary-numeric', element, effect, {
        values: bounds,
        from: `boundaryValues(${display(constraints.min ?? '')}, ${display(constraints.max ?? '')}, ${display(constraints.step ?? '')})`,
        assert: `inside min=${constraints.min ?? '—'} max=${constraints.max ?? '—'} is accepted; outside is refused visibly — never silently stored as something else`,
      }),
    );
  } else if (type === 'number' || type === 'range') {
    ideas.push(
      idea('partition-unbounded-number', element, effect, {
        values: PROBES.number.map(display),
        from: 'PROBES.number',
        assert:
          'no bound is declared, so find which of these the product accepts and what it stores, then check that against what the page claims. Non-numeric text cannot be typed into a number input — send it through the API',
      }),
    );
  }

  if (constraints.maxLength !== null) {
    ideas.push(
      idea('boundary-length', element, effect, {
        values: lengthBoundaries(constraints.maxLength).map(display),
        from: `lengthBoundaries(${constraints.maxLength})`,
        assert: `at most ${constraints.maxLength} characters are stored. The browser truncates typed input at maxlength, so n+1 through the UI proves only the attribute — send n+1 through the API to prove the server`,
      }),
    );
  }

  if (constraints.pattern !== null) {
    ideas.push(
      idea('pattern-conformance', element, effect, {
        values: [],
        from: null,
        assert: `one value matching /${constraints.pattern}/ is accepted, and one breaking each part of it is refused. Values not generated — read the pattern`,
      }),
    );
  }

  if (type === 'email') {
    ideas.push(
      idea('partition-text', element, effect, {
        values: PROBES.email.map(display),
        from: 'PROBES.email',
        assert:
          'no TLD and an empty local part are refused; plus addressing is accepted — refusing it is the over-strict defect',
      }),
    );
  } else if (type !== null && DATE_TYPES.has(type)) {
    ideas.push(
      idea('partition-text', element, effect, {
        values: PROBES.date.map(display),
        from: 'PROBES.date',
        assert:
          'impossible dates are refused; epoch and far-future dates are stored and shown as entered. Reach timezone and DST cases with page.clock',
      }),
    );
  } else if (TEXT_TYPES.has(type) && bounds.length === 0) {
    const withLong = constraints.maxLength === null;
    ideas.push(
      idea('partition-text', element, effect, {
        values: [...PROBES.text, ...(withLong ? [PROBES.longText] : [])].map(display),
        from: withLong ? 'PROBES.text, PROBES.longText' : 'PROBES.text',
        assert:
          'each is stored and rendered exactly as entered, or refused with a message — markup is shown as text, never run. The full set is for fields that cross a trust boundary; sample it on low-risk ones',
      }),
    );
  }

  return ideas;
}

/** Top-level request fields, the ones whose absence the server should notice. */
function topLevel(fields: FieldShape[]): FieldShape[] {
  return fields.filter((field) => !field.path.includes('.') && !field.path.includes('['));
}

function wrongTypeFor(field: FieldShape): string {
  if (field.types.includes('number')) return `${JSON.stringify(field.path)}: "abc"`;
  if (field.types.includes('boolean')) return `${JSON.stringify(field.path)}: "yes"`;
  return `${JSON.stringify(field.path)}: 123`;
}

/**
 * A read worth checking a write against: a GET that returned data.
 *
 * The first real run offered `GET /event` — an analytics beacon with no body — as the
 * read that proves a login. A bodiless GET cannot show that anything was stored.
 */
function returnsData(endpoint: EndpointShape): boolean {
  return endpoint.method === 'GET' && endpoint.response.length > 0;
}

/** The read that proves a write: the same template, or its collection. */
export function readBackFor(
  write: EndpointShape,
  dictionary: EndpointShape[],
): EndpointShape | null {
  const collection = write.template.replace(/\/\{[^}]+\}$/, '');
  return (
    dictionary.find(
      (endpoint) =>
        returnsData(endpoint) &&
        (endpoint.template === write.template || endpoint.template === collection),
    ) ?? null
  );
}

function apiIdeas(dictionary: EndpointShape[]): TestIdea[] {
  const ideas: TestIdea[] = [];
  const writes: Effect = { tag: '@writes', untagged: null };
  for (const write of dictionary.filter((endpoint) => MUTATING.has(endpoint.method))) {
    const target = `${write.method} ${write.template}`;
    const fields = topLevel(write.request);
    ideas.push({
      heuristic: 'negative-set',
      level: 'api',
      target,
      unique: true,
      values: [
        ...fields.map((field) => `omit ${JSON.stringify(field.path)}`),
        ...fields.map(wrongTypeFor),
        '{}',
        '[1, 2, 3]',
        '{ ...valid, "unknown": "y" }',
      ],
      from: null,
      assert:
        'each is refused with a 4xx that names the problem — never a 5xx, and never a 2xx that stores a default',
      ...writes,
    });
    const read = readBackFor(write, dictionary);
    ideas.push({
      heuristic: 'reread-after-write',
      level: 'api',
      target: read === null ? target : `${target} → GET ${read.template}`,
      unique: true,
      values: [],
      from: null,
      assert:
        read === null
          ? 'no read endpoint was captured for this write, so persistence cannot be proven at the API level from this scan — find the read, or prove it through the UI'
          : `the record the write reported comes back from GET ${read.template} with the values sent — a write that echoes its input and stores nothing passes every other check`,
      ...writes,
    });
  }
  return ideas;
}

function groupIdeas(
  group: string,
  elements: ScannedElement[],
  dictionary: EndpointShape[],
): TestIdea[] {
  const ideas: TestIdea[] = [];
  const usable = elements.filter((element) => element.blocker === null);
  const submits = usable.filter((element) => element.affordance === 'submit');
  const authenticates = elements.some((element) => element.type === 'password');

  // A value is only proven stored by submitting it, so a field in a form that submits is
  // a writing test and a field on its own changes nothing on the server.
  const effect = (writing: boolean): Effect =>
    authenticates
      ? { tag: null, untagged: AUTHENTICATES }
      : { tag: writing ? '@writes' : '@read-only', untagged: null };
  const fieldEffect = effect(submits.length > 0);

  for (const element of usable) {
    if (element.affordance === 'input') ideas.push(...fieldIdeas(element, fieldEffect));
  }

  const checkboxes = usable.filter((element) => element.type === 'checkbox');
  if (checkboxes.length >= 2) {
    ideas.push({
      heuristic: 'selection-none-some-all',
      level: 'e2e',
      target: `${checkboxes.length} checkboxes in ${group}`,
      unique: checkboxes.every((checkbox) => checkbox.unique),
      values: ['none', 'exactly one', 'all'],
      from: null,
      assert: 'the result reflects exactly the selection — none and all are the cases that break',
      ...fieldEffect,
    });
  }

  const parameters = usable
    .map((element) => {
      if (element.tag === 'select') return element.constraints?.options.length ?? 0;
      if (element.type === 'checkbox') return 2;
      return 0;
    })
    .filter((count) => count >= 2);
  if (parameters.length >= 3) {
    const exhaustive = parameters.reduce((product, count) => product * count, 1);
    const [first = 0, second = 0] = [...parameters].sort((a, b) => b - a);
    ideas.push({
      heuristic: 'pairwise-sizing',
      level: 'e2e',
      target: `${parameters.length} parameters in ${group}`,
      unique: true,
      values: [`exhaustive ${exhaustive}`, `pairwise at least ${first * second}`],
      from: null,
      assert:
        'every pair of values appears in at least one case. Say in the design that pairwise was used — the array itself is not generated yet',
      ...fieldEffect,
    });
  }

  const reads = dictionary.filter(returnsData);
  const submitEffect = effect(true);
  for (const submit of submits) {
    ideas.push(
      idea('negative-set', submit, submitEffect, {
        values: NEGATIVE_SET,
        from: null,
        assert:
          'each is refused with a message and sends no write. Drop the ones that cannot apply here and list them under not_covered',
      }),
      idea('double-submit', submit, submitEffect, {
        values: [],
        from: null,
        assert:
          'two fast clicks produce exactly one write call in the network capture, and one record — not two',
      }),
      idea('back-after-submit', submit, submitEffect, {
        values: [],
        from: null,
        assert:
          'submit, go back, submit again: no duplicate record, no resurrected state, no stale-token error left unhandled',
      }),
      idea('reread-after-write', submit, submitEffect, {
        values: reads.slice(0, 3).map((read) => `GET ${read.template}`),
        from: null,
        assert:
          reads.length === 0
            ? 'reload and find what was submitted. No read returning data was captured, so assert the write call too — a DOM check alone sees only an optimistic render'
            : 'after submitting, one of these reads returns what was submitted. Assert the read or the call, not only the render — the UI can look right over a failed write',
      }),
    );
  }
  return ideas;
}

function toggleIdeas(elements: ScannedElement[]): TestIdea[] {
  return elements
    .filter(
      (element) =>
        element.affordance === 'toggle' &&
        element.blocker === null &&
        Object.keys(element.stateAttributes).length > 0,
    )
    .map((element) =>
      idea(
        'repeat-transition',
        element,
        { tag: null, untagged: MAY_PERSIST },
        {
          values: ['press 1: flips', 'press 2: flips back', 'press 3: flips again'],
          from: null,
          assert: `${Object.keys(element.stateAttributes).join(', ')} changes on every press, not only the first — a control that accepts one transition and ignores the rest passes any single-press test`,
        },
      ),
    );
}

/**
 * One idea per heuristic, target and values.
 *
 * Controls that share a selector — two checkboxes both reached by `locator('input')` —
 * produced the same case twice. The duplicate adds nothing but reading, and the shared
 * selector is already flagged as not unique.
 */
function distinct(ideas: TestIdea[]): TestIdea[] {
  const seen = new Set<string>();
  return ideas.filter((item) => {
    const key = `${item.heuristic}|${item.target}|${item.values.join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A saved scan from before the scanner recorded affordances and input constraints. */
function predatesFormat(scan: PageScan): boolean {
  return scan.interactive.some((element) => element.affordance === undefined);
}

export function ideasFor(input: IdeasInput): Ideas {
  const { scan, dictionary } = input;

  if (predatesFormat(scan)) {
    return {
      ideas: [],
      notGenerated: [
        'this scan predates the format that records affordances and input constraints — re-run `npm run scan -- <url> <out.json>` and generate from the new file',
      ],
    };
  }

  const groups = new Map<string, ScannedElement[]>();
  for (const element of scan.interactive) {
    const key = element.formIndex === null ? 'the page' : `form ${element.formIndex}`;
    groups.set(key, [...(groups.get(key) ?? []), element]);
  }

  const collected: TestIdea[] = [];
  for (const [group, elements] of groups) {
    collected.push(...groupIdeas(group, elements, dictionary));
  }
  collected.push(...toggleIdeas(scan.interactive));
  collected.push(...apiIdeas(dictionary));
  const ideas = distinct(collected);

  const notGenerated: string[] = [];
  const blocked = scan.interactive.filter((element) => element.blocker !== null);
  if (blocked.length > 0) {
    const reasons = [...new Set(blocked.map((element) => element.blocker))].join('; ');
    notGenerated.push(
      `${blocked.length} control(s) blocked when scanned (${reasons}) — nothing generated for them`,
    );
  }
  const passwords = scan.interactive.filter((element) => element.type === 'password');
  if (passwords.length > 0) {
    notGenerated.push(
      `${passwords.length} password field(s): required-field cases only, and every idea in that form is left untagged — credential attempts run on local only, and an agent never types a real password`,
    );
  }
  const unscanned = (scan.frames?.length ?? 0) + (scan.shadowHosts?.length ?? 0);
  if (unscanned > 0) {
    notGenerated.push(
      `${unscanned} frame(s) or shadow root(s) were not scanned, so their controls have no ideas`,
    );
  }
  if (!dictionary.some((endpoint) => MUTATING.has(endpoint.method))) {
    notGenerated.push(
      'no write was captured (the scan never submits), so API-level negative and read-back ideas are absent — the submit ideas cover the same risks through the UI',
    );
  }
  const stateless = scan.interactive.filter(
    (element) =>
      element.affordance === 'toggle' && Object.keys(element.stateAttributes).length === 0,
  );
  if (stateless.length > 0) {
    notGenerated.push(
      `${stateless.length} toggle(s) expose no state, so a repeat-transition test would have nothing to assert — a testability finding, in the scan`,
    );
  }

  return { ideas, notGenerated };
}

export function formatIdeas(result: Ideas, source: string): string {
  const lines = [`--- Test ideas: ${result.ideas.length} generated from ${source} ---`, ''];
  for (const level of ['api', 'e2e'] as const) {
    for (const item of result.ideas.filter((entry) => entry.level === level)) {
      const warn = item.unique ? '' : '  (selector matches several elements — see the scan)';
      const tag = item.tag ?? `untagged: ${item.untagged ?? 'local only'}`;
      lines.push(
        `${level} · ${item.target}${warn}`,
        `  ${heuristic(item.heuristic).name}  [${item.heuristic} · ${tag}]`,
      );
      if (item.values.length > 0) {
        const from =
          item.from === null ? '' : `  ← import from src/fixtures/probes.js: ${item.from}`;
        lines.push(`  values: ${item.values.join(' · ')}${from}`);
      }
      lines.push(`  assert: ${item.assert}`, '');
    }
  }

  if (result.notGenerated.length > 0) {
    lines.push('--- Not generated — what this scan could not support ---', '');
    for (const reason of result.notGenerated) lines.push(`- ${reason}`);
    lines.push('');
  }

  lines.push('--- Gated — `npm run assert-quality` refuses a spec that skips these ---', '');
  for (const entry of gated()) lines.push(`- ${entry.name}  [${entry.gate?.join(', ')}]`);
  lines.push('');

  const judgement = inMode('judgement');
  lines.push(`--- Still yours — judgement no script makes (${judgement.length}) ---`, '');
  for (const entry of judgement) lines.push(`- ${entry.name} (${entry.skill})`);
  return lines.join('\n');
}
