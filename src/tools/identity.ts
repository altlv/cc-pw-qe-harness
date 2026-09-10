/**
 * Answers one question: **are these two observations the same element?**
 *
 * The harness already answered it three times, badly. `reveal.ts` builds a
 * string key to diff before against after, `crawl.ts` fingerprints page shape to
 * cluster templates, and `page-scanner.ts` counts selector collisions. Each is
 * exact string equality, which is adequate for "what appeared on hover" and
 * useless for anything that spans a change: rename a button from `Save` to
 * `Save changes` and those all report one element gone and another arrived.
 *
 * Four capabilities turn out to be this one question wearing different hats —
 * self-healing, fuzzy matching, drift detection between two scans, and the
 * state-diffing an exploratory driver needs. Building it once is the point.
 *
 * Two principles run through the design.
 *
 * **Identity is redundant, not singular.** One selector can only answer "did it
 * match?". A dozen weak signals can answer "which of these candidates did you
 * mean?", which is the question that matters when the page has changed. This
 * matters most on the ordinary web: most applications have no test ids at all,
 * so an approach that leans on them has nothing to work with.
 *
 * **A score without evidence is not usable.** Every result carries the signals
 * that agreed and the ones that did not, because a healed selector must be
 * *proposed* and reviewed, never applied silently. A test re-pointed at the
 * wrong element passes while asserting nothing, which is precisely the failure
 * `assert-quality` exists to prevent.
 */

export interface Fingerprint {
  tag: string;
  role: string | null;
  /** Accessible name — the strongest human-meaningful signal. */
  name: string | null;
  testId: string | null;
  /**
   * The HTML `name` attribute of a form field.
   *
   * Quietly one of the best signals available, and the one most often
   * overlooked. A visible label is copy and gets reworded by whoever owns the
   * words; `name="shipCountry"` is a contract with the server and changing it
   * breaks the backend, so it survives redesigns that rewrite everything else.
   */
  fieldName: string | null;
  /** Raw id. Whether it is worth anything is decided by `isStableId`. */
  id: string | null;
  type: string | null;
  href: string | null;
  /** Ancestor tags from the outside in, e.g. ['main', 'form', 'div']. */
  ancestors: string[];
  /** Position among siblings. Deliberately the weakest signal here. */
  siblingIndex: number | null;
  /** Text near the element — a label, a heading, a table row's first cell. */
  nearbyText: string | null;
  /** Digest of an input's constraints: required, min, max, pattern. */
  constraints: string | null;
}

export interface SignalMatch {
  signal: string;
  weight: number;
  matched: boolean;
  /** False when one side lacked the signal, so it could not be compared. */
  comparable: boolean;
  /**
   * Partial agreement, 0..1, for signals that are a matter of degree rather than
   * yes or no. Absent on the exact ones.
   */
  degree?: number;
}

/** Records a signal whose agreement is graded rather than binary. */
function signalsPushGraded(
  signals: SignalMatch[],
  signal: string,
  weight: number,
  comparable: boolean,
  degree: number,
): void {
  signals.push({ signal, weight, comparable, matched: degree > 0.85, degree });
}

export interface MatchScore {
  /** 0..1 across the signals both sides actually carried. */
  score: number;
  signals: SignalMatch[];
  /**
   * True when the score clears the threshold **and** at least one signal that
   * means something on its own agreed. A high score built only from tag, role
   * and position is a page-shaped coincidence, not a match.
   */
  confident: boolean;
}

/**
 * Framework-generated ids change between builds, so they identify a render
 * rather than an element. React's `:r0:`, Ember's `ember123`, ExtJS's
 * `ext-gen456`, anything starting with a digit, and long hex blobs.
 */
export function isStableId(id: string | null): boolean {
  if (id === null || id === '') return false;
  if (/^[0-9]/.test(id)) return false;
  if (/^:r[0-9a-z]+:$/i.test(id)) return false;
  if (/^(ember|ext-gen|mat-|cdk-|radix-|headlessui-)/i.test(id)) return false;
  if (/^[0-9a-f]{16,}$/i.test(id)) return false;
  // A generated suffix on a readable stem is still generated.
  if (/[-_][0-9a-f]{12,}$/i.test(id)) return false;
  return true;
}

/**
 * What each signal is worth when it agrees.
 *
 * Ordered by how much a change to the page can move them.
 *
 * Note what is *not* at the centre of this. Test ids are decisive when present
 * and are almost never present: of the sites scanned while building this, only
 * the fixture we wrote ourselves had any. The signals that actually carry real
 * pages are the accessible name, a link's href, a form field's name attribute
 * and a hand-written id — so those are what the weighting is tuned for, and a
 * test id is treated as a bonus rather than the mechanism.
 *
 * A sibling index survives almost nothing, which is why it sits at the bottom
 * and can never carry a match alone.
 */
const WEIGHTS = {
  testId: 1.0,
  fieldName: 0.9,
  stableId: 0.8,
  roleAndName: 0.7,
  href: 0.55,
  name: 0.5,
  constraints: 0.3,
  nearbyText: 0.3,
  ancestors: 0.25,
  // Similo's optimised weights put type among its most valuable properties, well
  // above where a first guess would place it.
  type: 0.6,
  role: 0.15,
  /**
   * Partial agreement on wording. Deliberately weak, and deliberately absent
   * from FLOORS.
   *
   * String similarity is the easiest way to click confidently on the wrong
   * thing: "Delete" and "Delete all" are highly similar and very different
   * buttons, as are "Save" and "Save as". So similarity may *confirm* a match
   * that something structural already supports, and may break a tie between
   * candidates — but it can never create one on its own.
   *
   * Note where that guarantee actually comes from: **absence from FLOORS**, not
   * from this number being small. The weight only moves the score. An earlier
   * comment credited the weight, which was wrong, and a surviving mutation is
   * what said so.
   */
  nameSimilarity: 0.35,
  neighbourSimilarity: 0.25,
  tag: 0.1,
  generatedId: 0.05,
  siblingIndex: 0.05,
} as const;

/**
 * Signals decisive enough to carry a match alone, and the score each guarantees.
 *
 * A flat weighted average was the first attempt and it was wrong: a matching test
 * id scored 0.36 because the tag, role, ancestors and position had all changed
 * around it. Many weak disagreements outvoted one conclusive agreement, which
 * inverts what those signals are for.
 *
 * So a matching strong signal sets a floor instead of casting a vote. "If the
 * test id is the same, this is the same element" is a rule someone can argue
 * with, which is better than a number nobody can.
 */
const FLOORS: Record<string, number> = {
  testId: 0.95,
  // Level with a hand-written id, and for the same reason: both are names a
  // person chose and the application depends on.
  fieldName: 0.85,
  stableId: 0.85,
  href: 0.75,
  roleAndName: 0.72,
  name: 0.65,
};

const CONFIDENT_AT = 0.6;

function normalise(text: string | null): string | null {
  if (text === null) return null;
  const trimmed = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return trimmed === '' ? null : trimmed;
}

/** How much two ancestor chains agree, from the outside in. */
function ancestorOverlap(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  let shared = 0;
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) break;
    shared += 1;
  }
  return shared / Math.max(left.length, right.length);
}

/**
 * Normalised edit distance, 0..1.
 *
 * Similo uses Levenshtein on visible text and, once its weights were optimised
 * against real sites, that property scored among the highest of the fourteen it
 * considers. Worth having — but see how it is used below, because a similarity
 * score is also the easiest way to click confidently on the wrong thing.
 */
export function textSimilarity(left: string | null, right: string | null): number {
  const a = normalise(left);
  const b = normalise(right);
  if (a === null || b === null) return 0;
  if (a === b) return 1;

  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);

  for (let row = 1; row < rows; row += 1) {
    const current = [row];
    for (let col = 1; col < cols; col += 1) {
      const substitution = (previous[col - 1] ?? 0) + (a[row - 1] === b[col - 1] ? 0 : 1);
      const insertion = (current[col - 1] ?? 0) + 1;
      const deletion = (previous[col] ?? 0) + 1;
      current[col] = Math.min(substitution, insertion, deletion);
    }
    previous = current;
  }

  const distance = previous[cols - 1] ?? 0;
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * Overlap between two bags of words, 0..1.
 *
 * Surrounding text is rarely identical between two renders — a price changes, a
 * count updates — but the words around a control mostly persist. Similo treats
 * neighbour text as a word set for the same reason.
 */
export function wordSetSimilarity(left: string | null, right: string | null): number {
  // Every word counts, including the short ones. Filtering words of two letters
  // or fewer looked like sensible stopword removal and was actively harmful: it
  // deleted the "as" from "Save as", so "Save" and "Save as" scored a perfect
  // 1.00 — the most dangerous pair on the list looking like an exact match. The
  // discriminating word is often the shortest one.
  const words = (text: string | null): Set<string> =>
    new Set((normalise(text) ?? '').split(/[^a-z0-9]+/).filter((word) => word !== ''));

  const a = words(left);
  const b = words(right);
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

/**
 * Scores one pair, and shows its working.
 *
 * Only signals present on **both** sides count toward the total. An element that
 * gained a test id should not be penalised for the other side lacking one — the
 * question is whether what they share agrees, not whether they are identical.
 */
export function score(before: Fingerprint, after: Fingerprint): MatchScore {
  const signals: SignalMatch[] = [];

  const add = (signal: keyof typeof WEIGHTS, comparable: boolean, matched: boolean): void => {
    signals.push({ signal, weight: WEIGHTS[signal], matched, comparable });
  };

  const bothHave = (left: unknown, right: unknown): boolean =>
    left !== null && left !== undefined && right !== null && right !== undefined;

  add('testId', bothHave(before.testId, after.testId), before.testId === after.testId);
  add(
    'fieldName',
    bothHave(before.fieldName, after.fieldName),
    before.fieldName === after.fieldName,
  );

  const idsComparable = bothHave(before.id, after.id);
  const idsStable = isStableId(before.id) && isStableId(after.id);
  add(idsStable ? 'stableId' : 'generatedId', idsComparable, before.id === after.id);

  const nameBefore = normalise(before.name);
  const nameAfter = normalise(after.name);
  const namesMatch = nameBefore !== null && nameBefore === nameAfter;
  const rolesMatch = before.role !== null && before.role === after.role;

  add(
    'roleAndName',
    bothHave(before.role, after.role) && bothHave(nameBefore, nameAfter),
    rolesMatch && namesMatch,
  );
  add('name', bothHave(nameBefore, nameAfter), namesMatch);
  add('role', bothHave(before.role, after.role), rolesMatch);
  add('href', bothHave(before.href, after.href), before.href === after.href);
  add('type', bothHave(before.type, after.type), before.type === after.type);
  add('tag', true, before.tag === after.tag);
  add(
    'constraints',
    bothHave(before.constraints, after.constraints),
    before.constraints === after.constraints,
  );
  add(
    'nearbyText',
    bothHave(normalise(before.nearbyText), normalise(after.nearbyText)),
    normalise(before.nearbyText) === normalise(after.nearbyText),
  );

  // Graded signals: their contribution is the similarity itself rather than a
  // yes/no, so "Add to basket" against "Add to Bag" counts for something without
  // being treated as a match.
  const nameCloseness = textSimilarity(before.name, after.name);
  signalsPushGraded(
    signals,
    'nameSimilarity',
    WEIGHTS.nameSimilarity,
    bothHave(nameBefore, nameAfter),
    nameCloseness,
  );

  const neighbourCloseness = wordSetSimilarity(before.nearbyText, after.nearbyText);
  signalsPushGraded(
    signals,
    'neighbourSimilarity',
    WEIGHTS.neighbourSimilarity,
    bothHave(before.nearbyText, after.nearbyText),
    neighbourCloseness,
  );

  const overlap = ancestorOverlap(before.ancestors, after.ancestors);
  add('ancestors', before.ancestors.length > 0 && after.ancestors.length > 0, overlap > 0.6);

  add(
    'siblingIndex',
    bothHave(before.siblingIndex, after.siblingIndex),
    before.siblingIndex === after.siblingIndex,
  );

  const comparable = signals.filter((signal) => signal.comparable);
  const available = comparable.reduce((total, signal) => total + signal.weight, 0);
  const agreed = comparable.reduce(
    (total, signal) => total + signal.weight * (signal.degree ?? (signal.matched ? 1 : 0)),
    0,
  );

  const weighted = available === 0 ? 0 : agreed / available;

  // The strongest agreeing signal sets a floor the weak ones cannot drag below.
  const floor = comparable
    .filter((signal) => signal.matched && signal.signal in FLOORS)
    .reduce((best, signal) => Math.max(best, FLOORS[signal.signal] ?? 0), 0);

  const total = Math.max(weighted, floor);
  const strongAgreed = floor > 0;

  return { score: total, signals, confident: total >= CONFIDENT_AT && strongAgreed };
}

export interface Pairing {
  beforeIndex: number;
  afterIndex: number;
  result: MatchScore;
}

export interface MatchResult {
  pairs: Pairing[];
  /** Present before, matched to nothing after: removed, or changed past recognition. */
  unmatchedBefore: number[];
  /** Present after, matched to nothing before: genuinely new. */
  unmatchedAfter: number[];
}

/**
 * Pairs two observations of the same page.
 *
 * Greedy best-first: score every combination, take the strongest pair, remove
 * both, repeat. Not optimal in the assignment-problem sense, and deliberately
 * so — an optimal matching can pair two elements neither of which is anyone's
 * best guess, purely to raise a global total. Best-first keeps every pairing
 * defensible on its own, which matters when a human has to review it.
 */
export function matchAll(
  before: Fingerprint[],
  after: Fingerprint[],
  threshold = CONFIDENT_AT,
): MatchResult {
  const candidates: Pairing[] = [];

  for (let beforeIndex = 0; beforeIndex < before.length; beforeIndex += 1) {
    for (let afterIndex = 0; afterIndex < after.length; afterIndex += 1) {
      const result = score(before[beforeIndex]!, after[afterIndex]!);
      // Confidence, not raw score. A surviving mutation showed why: raising the
      // wording weight could push "Delete" and "Delete all" over a score
      // threshold and pair them, while `confident` stayed false because nothing
      // decisive agreed. Pairing on the number would have quietly re-pointed a
      // selector at a different button.
      if (result.confident && result.score >= threshold) {
        candidates.push({ beforeIndex, afterIndex, result });
      }
    }
  }

  candidates.sort((left, right) => right.result.score - left.result.score);

  const usedBefore = new Set<number>();
  const usedAfter = new Set<number>();
  const pairs: Pairing[] = [];

  for (const candidate of candidates) {
    if (usedBefore.has(candidate.beforeIndex) || usedAfter.has(candidate.afterIndex)) continue;
    usedBefore.add(candidate.beforeIndex);
    usedAfter.add(candidate.afterIndex);
    pairs.push(candidate);
  }

  return {
    pairs,
    unmatchedBefore: before.map((_, index) => index).filter((index) => !usedBefore.has(index)),
    unmatchedAfter: after.map((_, index) => index).filter((index) => !usedAfter.has(index)),
  };
}

/** A short human-readable label, for reports and proposals. */
export function describeFingerprint(fingerprint: Fingerprint): string {
  // Ordered the way a person would refer to the thing, which on most sites means
  // its name long before any attribute.
  if (fingerprint.name !== null) {
    return `${fingerprint.role ?? fingerprint.tag} "${fingerprint.name}"`;
  }
  if (fingerprint.fieldName !== null) return `${fingerprint.tag}[name=${fingerprint.fieldName}]`;
  if (isStableId(fingerprint.id)) return `#${fingerprint.id}`;
  if (fingerprint.testId !== null) return `[testid=${fingerprint.testId}]`;
  return `<${fingerprint.tag}>`;
}

/**
 * Why a pair was considered the same, in words.
 *
 * This is the half that makes healing reviewable rather than magic. A proposal
 * that says "0.82" tells nobody anything; one that says the accessible name and
 * href agreed while the id changed can be accepted or rejected on sight.
 */
export function explainMatch(result: MatchScore): string {
  const comparable = result.signals.filter((signal) => signal.comparable);
  const agreed = comparable.filter((signal) => signal.matched).map((signal) => signal.signal);
  const differed = comparable.filter((signal) => !signal.matched).map((signal) => signal.signal);

  const parts = [`score ${result.score.toFixed(2)}`];
  parts.push(agreed.length > 0 ? `agreed on ${agreed.join(', ')}` : 'agreed on nothing');
  if (differed.length > 0) parts.push(`differed on ${differed.join(', ')}`);
  if (!result.confident) {
    parts.push('NOT confident — no signal that means anything on its own agreed');
  }
  return parts.join('; ');
}
