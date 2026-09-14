import type { FindingKind } from '../quality/assertions.js';

/**
 * The heuristics the skills teach, sorted by what does the work.
 *
 * The skills carry many heuristic items as prose, and nothing connected any of them to
 * an action. That costs twice. An agent spends turns deriving, by reasoning, answers a
 * script could print for free, like the six boundary values of a field whose bounds the
 * scan already read. And the heuristics that really need judgement get lost in the same
 * list, so they get the same skim.
 *
 * Every entry is in exactly one mode:
 *
 *  - **scripted**: a command already does it. An agent reads the output, not the skill.
 *  - **generated**: `npm run ideas` turns a saved scan into the concrete cases: values,
 *    target, level, tag. A coder writes them rather than deriving them.
 *  - **scriptable**: a script could do it and none exists yet. Listed so the gap is a
 *    decision, with what building it would need.
 *  - **judgement**: stays with whoever is doing the work, and `why` says why. Not every
 *    heuristic should be a script. One that decides what matters, or whether something
 *    is wrong, turns into a confident, tidy false negative once scripted.
 *
 * Separately, an entry may name a **gate**: the `npm run assert-quality` findings that
 * refuse a spec which skipped it. Mode says who produces the work; gate says what
 * checks it was done. Advice with no gate gets skipped.
 *
 * Every entry is for both role families. A coder uses the judgement list while writing
 * a spec just as a tester does while exploring; what differs is the output.
 *
 * This is a catalogue of the heuristics that change what an agent does, not a count of
 * every sentence in the skills. `tests/unit/heuristics.test.ts` holds it to the code:
 * a skill that exists, a command that exists, and a generator for every generated entry.
 */

export type HeuristicMode = 'scripted' | 'generated' | 'scriptable' | 'judgement';

export interface Heuristic {
  id: string;
  /** The skill that teaches it. Must be a directory under `.claude/skills/`. */
  skill: string;
  name: string;
  mode: HeuristicMode;
  /** The command that does it, for scripted and generated entries. Null otherwise. */
  by: string | null;
  /** Why this mode. For judgement, why a script must not; for scriptable, what it needs. */
  why: string;
  /** The `assert-quality` findings that refuse a spec skipping this. */
  gate?: FindingKind[];
}

const IDEAS = 'npm run ideas';
const SCAN = 'npm run scan';
const DEEP = 'SCAN_DEEP=1 npm run scan';
const QUALITY = 'npm run assert-quality';

export const HEURISTICS: readonly Heuristic[] = [
  // ── test-techniques: values ──────────────────────────────────────────────────────
  {
    id: 'boundary-numeric',
    skill: 'test-techniques',
    name: 'Boundary values of a declared numeric range',
    mode: 'generated',
    by: IDEAS,
    why: 'min, max and step are in the scan; the six values are arithmetic',
  },
  {
    id: 'boundary-length',
    skill: 'test-techniques',
    name: 'Boundary values of a declared maximum length',
    mode: 'generated',
    by: IDEAS,
    why: 'maxlength is in the scan; n−1, n and n+1 are arithmetic',
  },
  {
    id: 'partition-unbounded-number',
    skill: 'test-techniques',
    name: 'Equivalence classes of a number field with no declared bound',
    mode: 'generated',
    by: IDEAS,
    why: 'the classes come from the field type; the probes are the numeric table in test-data-probes',
  },
  {
    id: 'partition-text',
    skill: 'test-design',
    name: 'Probe values for a text, email or date field',
    mode: 'generated',
    by: IDEAS,
    why: 'the probes per field type are fixed tables in test-data-probes; which fields earn the full set is still a risk call',
  },
  {
    id: 'partition-required',
    skill: 'test-techniques',
    name: 'Empty and whitespace-only against a required field',
    mode: 'generated',
    by: IDEAS,
    why: 'required is in the scan',
  },
  {
    id: 'partition-options',
    skill: 'test-techniques',
    name: 'One case per option of a select, placeholder included',
    mode: 'generated',
    by: IDEAS,
    why: 'the options are in the scan',
  },
  {
    id: 'pattern-conformance',
    skill: 'test-techniques',
    name: 'Values that match and violate a declared pattern',
    mode: 'generated',
    by: IDEAS,
    why: 'the pattern is in the scan; the values are not generated, because inverting an arbitrary regex correctly is harder than reading it',
  },
  {
    id: 'pairwise-sizing',
    skill: 'test-techniques',
    name: 'Whether a form has enough parameters to need pairwise, and how many cases',
    mode: 'generated',
    by: IDEAS,
    why: 'the parameters and their option counts are in the scan',
  },
  {
    id: 'pairwise-array',
    skill: 'test-techniques',
    name: 'The pairwise covering array itself',
    mode: 'scriptable',
    by: null,
    why: 'a greedy all-pairs generator is small; not built until a subject has a form with three or more real parameters',
  },
  {
    id: 'page-claims-as-boundaries',
    skill: 'test-techniques',
    name: "The page's own claims are boundaries",
    mode: 'judgement',
    by: null,
    why: '"Maximum purchase amount of 10" is prose, not an attribute; reading it as a limit is comprehension',
  },
  {
    id: 'decision-table',
    skill: 'test-techniques',
    name: 'Decision table over a rule with several conditions',
    mode: 'judgement',
    by: null,
    why: 'the conditions and outcomes live in requirements and code, not in the DOM; an outcome nobody can state is a finding',
  },
  {
    id: 'state-model',
    skill: 'test-techniques',
    name: 'State transition table, including sneak paths',
    mode: 'judgement',
    by: null,
    why: 'the states are the product’s meaning; once a model exists, the switch coverage over it is scriptable',
  },
  {
    id: 'branch-coverage',
    skill: 'test-techniques',
    name: 'Branch coverage to find what is untested',
    mode: 'scriptable',
    by: null,
    why: 'needs V8 coverage collected from a subject we have the source of; none is wired',
  },
  {
    id: 'error-guessing',
    skill: 'test-techniques',
    name: 'Error guessing from a defect taxonomy',
    mode: 'judgement',
    by: null,
    why: 'where this system is weak is a guess about this system; a script would apply the taxonomy everywhere and bury the likely spots',
  },

  // ── test-techniques: sequences and writes ────────────────────────────────────────
  {
    id: 'negative-set',
    skill: 'test-techniques',
    name: 'Minimum negative set for a mutating operation',
    mode: 'generated',
    by: IDEAS,
    why: 'a submit control or a captured write is a mutating operation; the cases are fixed, and which apply is the coder’s call',
  },
  {
    id: 'reread-after-write',
    skill: 'test-techniques',
    name: 'Read the state back after every write',
    mode: 'generated',
    by: IDEAS,
    why: 'a submit plus a read endpoint in the captured traffic names both halves',
    gate: ['write-not-read-back'],
  },
  {
    id: 'double-submit',
    skill: 'test-techniques',
    name: 'Double-click submit',
    mode: 'generated',
    by: IDEAS,
    why: 'every submit control is a candidate; the assertion is one write, not two',
  },
  {
    id: 'back-after-submit',
    skill: 'test-techniques',
    name: 'Submit, go back, submit again',
    mode: 'generated',
    by: IDEAS,
    why: 'every submit control is a candidate',
  },
  {
    id: 'repeat-transition',
    skill: 'test-techniques',
    name: 'Repeat the same transition — the 1-switch bug',
    mode: 'generated',
    by: IDEAS,
    why: 'a toggle that exposes state can be pressed three times and its attribute asserted each time',
  },
  {
    id: 'selection-none-some-all',
    skill: 'test-techniques',
    name: 'Choose none, some, all',
    mode: 'generated',
    by: IDEAS,
    why: 'two or more checkboxes in one form are a selection',
  },
  {
    id: 'cancel-mid-flow',
    skill: 'test-techniques',
    name: 'Abandon a multi-step flow at each step in turn',
    mode: 'judgement',
    by: null,
    why: 'which pages form one flow is not visible in a single-page scan',
  },
  {
    id: 'change-setting-afterwards',
    skill: 'test-techniques',
    name: 'Create with one setting, then change it',
    mode: 'judgement',
    by: null,
    why: 'which settings reinterpret existing data is domain knowledge',
  },
  {
    id: 'continuous-use',
    skill: 'test-techniques',
    name: 'Continuous use without restarting',
    mode: 'scriptable',
    by: null,
    why: 'a long-running loop over the generated cases is mechanical; it needs the driver (queue item E5) to choose actions',
  },

  // ── visual-inspection ────────────────────────────────────────────────────────────
  {
    id: 'network-errors-on-load',
    skill: 'visual-inspection',
    name: 'Open the network panel before touching anything',
    mode: 'scripted',
    by: SCAN,
    why: 'the scan captures every call and prints each endpoint’s statuses, so a 4xx or a call with no response shows',
  },
  {
    id: 'console-errors-on-load',
    skill: 'visual-inspection',
    name: 'Open the console before touching anything',
    mode: 'scriptable',
    by: null,
    why: 'page.on("console") is one listener; the scan does not attach it yet',
  },
  {
    id: 'literal-strings',
    skill: 'visual-inspection',
    name: 'Search rendered text for lorem, test, TODO, undefined, NaN, [object',
    mode: 'scriptable',
    by: null,
    why: 'a text search over the rendered page is mechanical; reading every string for grammar is not',
  },
  {
    id: 'tab-through',
    skill: 'visual-inspection',
    name: 'Tab through it',
    mode: 'scripted',
    by: DEEP,
    why: 'the keyboard pass records tab order, controls with no visible focus, focus-only reveals and suspected traps',
  },
  {
    id: 'zoom-reflow',
    skill: 'visual-inspection',
    name: 'Zoom to 200% — reflow',
    mode: 'scripted',
    by: DEEP,
    why: 'the zoom pass measures horizontal overflow',
  },
  {
    id: 'phone-width',
    skill: 'visual-inspection',
    name: 'Phone width',
    mode: 'scripted',
    by: DEEP,
    why: 'the responsive pass diffs controls at a narrow viewport',
  },
  {
    id: 'occlusion-of-controls',
    skill: 'visual-inspection',
    name: 'A control covered by something else',
    mode: 'scripted',
    by: SCAN,
    why: 'each control is hit-tested after scrolling; the reverse direction, a panel over content, is the judgement entry below',
  },
  {
    id: 'occlusion-reverse',
    skill: 'visual-inspection',
    name: 'Occlusion the other way — a panel over content',
    mode: 'judgement',
    by: null,
    why: 'content is not a control, so nothing hit-tests it; it has to be seen',
  },
  {
    id: 'arithmetic',
    skill: 'visual-inspection',
    name: 'Do the arithmetic on numbers that should relate',
    mode: 'judgement',
    by: null,
    why: 'which numbers relate — subtotal, tax, total — is meaning; a script would pair the wrong ones',
  },
  {
    id: 'same-fact-twice',
    skill: 'visual-inspection',
    name: 'A value shown in two places is a free oracle',
    mode: 'judgement',
    by: null,
    why: 'recognising two renderings as one fact is comprehension',
  },
  {
    id: 'position-state-sweep',
    skill: 'visual-inspection',
    name: 'Sweep position × state',
    mode: 'judgement',
    by: null,
    why: 'the scroll pass samples positions; choosing which states to open needs the driver, and judging what is seen needs eyes',
  },
  {
    id: 'transient-surfaces',
    skill: 'visual-inspection',
    name: 'Open every mini-cart, modal, toast and drawer',
    mode: 'judgement',
    by: null,
    why: 'reaching them means interacting; queue item 4, after the driver',
  },
  {
    id: 'placeholder-rule',
    skill: 'visual-inspection',
    name: 'A visible placeholder is evidence about a class, not a typo',
    mode: 'judgement',
    by: null,
    why: 'finding the string is scriptable; deciding what family of defect it points at is not',
  },

  // ── exploratory-session ──────────────────────────────────────────────────────────
  {
    id: 'bugs-cluster',
    skill: 'exploratory-session',
    name: 'Bugs cluster — test harder right there',
    mode: 'judgement',
    by: null,
    why: 'where "there" is depends on what was just found',
  },
  {
    id: 'same-bug-elsewhere',
    skill: 'exploratory-session',
    name: 'The same bug lives in the siblings',
    mode: 'judgement',
    by: null,
    why: 'crawl clusters name template siblings; deciding the defect generalises is judgement',
  },
  {
    id: 'reproduce-twice',
    skill: 'exploratory-session',
    name: 'Déjà vu — reproduce every error and compare the message',
    mode: 'scriptable',
    by: null,
    why: 'replay and diff are mechanical once an action is recorded; needs the driver (E5)',
  },
  {
    id: 'charter',
    skill: 'exploratory-session',
    name: 'Charter, persona and constraint before exploring',
    mode: 'judgement',
    by: null,
    why: 'what to hunt is the decision a session exists to make',
  },
  {
    id: 'draw-the-flow',
    skill: 'work-discipline',
    name: 'Draw the flow before concluding how it works',
    mode: 'judgement',
    by: null,
    why: 'the drawing is cheap to make and the gaps it shows — a pointer nothing follows, a loop that never closes — are only visible as a whole; which flow to draw is the judgement',
  },

  // ── testability-audit ────────────────────────────────────────────────────────────
  {
    id: 'addressability',
    skill: 'testability-audit',
    name: 'Ambiguous, positional and unlabelled controls',
    mode: 'scripted',
    by: SCAN,
    why: 'the scan grades every selector and checks that it resolves to exactly one element',
  },
  {
    id: 'observable-state',
    skill: 'testability-audit',
    name: 'A toggle that exposes no state',
    mode: 'scripted',
    by: SCAN,
    why: 'the scan reads the state attributes and flags toggle-named controls without them',
  },
  {
    id: 'state-means-what-it-says',
    skill: 'testability-audit',
    name: 'Does the exposed state mean what it says?',
    mode: 'judgement',
    by: null,
    why: 'aria-expanded="true" on a panel that never opened needs someone to look at the panel',
  },

  // ── pwtest and the quality floor ─────────────────────────────────────────────────
  {
    id: 'scan-before-generate',
    skill: 'pwtest',
    name: 'Never invent a selector',
    mode: 'scripted',
    by: SCAN,
    why: 'the scan suggests the best available selector for every control',
  },
  {
    id: 'assertion-floor',
    skill: 'pwtest',
    name: 'A test must assert an observable outcome',
    mode: 'scripted',
    by: QUALITY,
    why: 'missing assertions and navigate-and-assert-once are detected statically',
    gate: ['no-assertion', 'navigation-only'],
  },
  {
    id: 'assert-both-layers',
    skill: 'pwtest',
    name: 'For a state change, assert the UI and the captured network call',
    mode: 'scripted',
    by: QUALITY,
    why: 'a test tagged as writing that drives the page and never checks the wire is detected statically',
    gate: ['write-unverified'],
  },
  {
    id: 'fragile-selector-marked',
    skill: 'pwtest',
    name: 'Follow the selector ladder; mark what is positional',
    mode: 'scripted',
    by: QUALITY,
    why: 'a class- or position-dependent CSS selector with no TODO (Fragile) marker is detected statically',
    gate: ['unmarked-fragile-selector'],
  },
  {
    id: 'tests-can-fail',
    skill: 'pwtest',
    name: 'The harness’s own tests can actually fail',
    mode: 'scripted',
    by: 'npm run mutate',
    why: 'mutation testing over the harness’s rules — it never touches a spec under apps/',
  },
  {
    id: 'learn-behaviour-first',
    skill: 'pwtest',
    name: 'Verify how the feature behaves before designing',
    mode: 'judgement',
    by: null,
    why: 'the assumption being checked is specific to the feature; a probe spec is how, not a generator',
  },

  // ── flaky-test-detection ─────────────────────────────────────────────────────────
  {
    id: 'no-sleep-for-flake',
    skill: 'flaky-test-detection',
    name: 'Never fix flake with a sleep',
    mode: 'scripted',
    by: QUALITY,
    why: 'waitForTimeout is refused by lint and by the analyzer',
    gate: ['banned-wait'],
  },
  {
    id: 'flake-serial-vs-parallel',
    skill: 'flaky-test-detection',
    name: 'Measure the rate alone and in parallel',
    mode: 'scriptable',
    by: null,
    why: 'two --repeat-each runs and a comparison; worth a command the first time a real flake is investigated',
  },
  {
    id: 'flake-cause',
    skill: 'flaky-test-detection',
    name: 'Classify the cause before fixing',
    mode: 'judgement',
    by: null,
    why: 'the serial-versus-parallel difference narrows it; the cause still needs reading the test',
  },

  // ── oracle-check and bug-report ──────────────────────────────────────────────────
  {
    id: 'name-the-oracle',
    skill: 'oracle-check',
    name: 'Name the consistency a finding violates',
    mode: 'judgement',
    by: null,
    why: 'deciding something is wrong is the one step a script must never take for us',
  },
  {
    id: 'worst-honest-case',
    skill: 'bug-report',
    name: 'Find the worst honest case and generalise',
    mode: 'judgement',
    by: null,
    why: 'impact is argued in the reader’s terms',
  },
];

export function heuristic(id: string): Heuristic {
  const found = HEURISTICS.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no heuristic "${id}" in the catalogue`);
  return found;
}

export function inMode(mode: HeuristicMode): Heuristic[] {
  return HEURISTICS.filter((entry) => entry.mode === mode);
}

export function gated(): Heuristic[] {
  return HEURISTICS.filter((entry) => (entry.gate ?? []).length > 0);
}

export function formatCatalogue(entries: readonly Heuristic[] = HEURISTICS): string {
  const modes: HeuristicMode[] = ['scripted', 'generated', 'scriptable', 'judgement'];
  const titles: Record<HeuristicMode, string> = {
    scripted: 'Scripted — a command already does it; read its output',
    generated: 'Generated — `npm run ideas` prints the cases from a saved scan',
    scriptable: 'Scriptable — no script yet; listed so the gap is a decision',
    judgement: 'Judgement — stays with whoever does the work',
  };
  const lines: string[] = [];
  for (const mode of modes) {
    const matching = entries.filter((entry) => entry.mode === mode);
    lines.push(`--- ${titles[mode]} (${matching.length}) ---`, '');
    for (const entry of matching) {
      const by = entry.by === null ? '' : `  [${entry.by}]`;
      const gate = (entry.gate ?? []).length > 0 ? `  gate: ${entry.gate?.join(', ')}` : '';
      lines.push(`- ${entry.name} (${entry.skill})${by}${gate}`, `    ${entry.why}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
