/**
 * Probe values, importable, so a spec loops over them instead of retyping them.
 *
 * `npm run ideas` names these sets in what it prints (`PROBES.text`), and a spec
 * consumes the same arrays. The alternative is every spec carrying its own copy of the
 * same ten strings, which drift the first time one copy gains a case the others lack.
 *
 * The values are the tables in `.claude/skills/test-design/references/test-data-probes.md`.
 * Numbers are strings because `fill()` takes a string.
 */
export const PROBES = {
  text: [
    '',
    'a',
    '   ',
    ' name ',
    "O'Brien",
    '🚀漢字éñ',
    '<script>alert(1)</script>',
    "' OR 1=1 --",
    '\0',
  ],
  longText: 'x'.repeat(1001),
  number: ['0', '-1', '3.14', '2147483647', '2147483648', '999999999999', ''],
  email: ['user@domain', '@domain.com', `${'x'.repeat(100)}@test.com`, 'user+tag@test.com'],
  date: ['2023-02-29', '2024-13-32', '1970-01-01', '9999-12-31'],
  required: ['', '   '],
} as const;

function finite(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Drops float noise: 0.1 + 0.2 prints as 0.3, not 0.30000000000000004. */
function num(value: number): string {
  return String(Number(value.toFixed(10)));
}

/**
 * Three-value boundaries (below, at, above) for each declared end of a range.
 *
 * Three rather than two because a declared bound is usually money, a quantity or a
 * limit, where test-techniques says the cost of being wrong earns it. The step is the
 * neighbour distance: for `step=5` the value below `min=10` is 5, not 9, because 9 is
 * refused for a different reason and would test the step rather than the bound.
 */
export function boundaryValues(
  min: string | null,
  max: string | null,
  step: string | null = null,
): string[] {
  const low = finite(min);
  const high = finite(max);
  const parsedStep = finite(step);
  const delta = parsedStep !== null && parsedStep > 0 ? parsedStep : 1;
  const values: number[] = [];
  if (low !== null) values.push(low - delta, low, low + delta);
  if (high !== null) values.push(high - delta, high, high + delta);
  return [...new Set(values)].sort((a, b) => a - b).map(num);
}

/** Strings one under, at, and one over a maximum length. */
export function lengthBoundaries(maxLength: number): string[] {
  return [maxLength - 1, maxLength, maxLength + 1]
    .filter((length) => length >= 0)
    .map((length) => 'x'.repeat(length));
}
