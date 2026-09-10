export type FindingKind =
  | 'no-assertion'
  | 'navigation-only'
  | 'unmarked-fragile-selector'
  | 'banned-wait'
  | 'unexplained-failure';

export interface QualityFinding {
  kind: FindingKind;
  testName: string;
  line: number;
  detail: string;
}

interface TestBlock {
  name: string;
  /** Masked: string and comment contents blanked. What the code-shaped rules judge. */
  code: string;
  /** Raw text at the same offsets. Only the selector rule reads this. */
  raw: string;
  line: number;
}

const TEST_DECL = /\btest(?:\.(?:only|skip|fixme))?\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

/**
 * Blanks the contents of strings and comments, preserving length and newlines.
 *
 * Test files carry example specs as fixture strings — this repo's own quality tests
 * do. Without masking, every `test(...)`, `waitForTimeout(...)` and selector inside a
 * fixture is analysed as though it were real code, and the gate reports findings
 * against code that does not exist. False positives are worse than no gate: they
 * teach people to ignore it.
 */
export function maskStringsAndComments(source: string): string {
  let out = '';
  let quote: string | null = null;
  let comment: 'line' | 'block' | null = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] as string;
    const next = source[i + 1];
    const escaped = quote !== null && source[i - 1] === '\\' && source[i - 2] !== '\\';

    if (comment !== null) {
      if (comment === 'line' && char === '\n') {
        comment = null;
        out += char;
        continue;
      }
      if (comment === 'block' && char === '*' && next === '/') {
        comment = null;
        out += '  ';
        i += 1;
        continue;
      }
      out += char === '\n' ? char : ' ';
      continue;
    }

    if (quote === null && char === '/' && (next === '/' || next === '*')) {
      comment = next === '/' ? 'line' : 'block';
      out += '  ';
      i += 1;
      continue;
    }

    if (quote === null && (char === '`' || char === "'" || char === '"')) {
      quote = char;
      out += char;
      continue;
    }

    if (quote !== null && char === quote && !escaped) {
      quote = null;
      out += char;
      continue;
    }

    out += quote !== null && char !== '\n' ? ' ' : char;
  }

  return out;
}

/**
 * Body of a test callback, found by matching braces from the declaration.
 *
 * Structure is located in the masked copy so a `test(...)` written inside a fixture
 * string is not mistaken for a real one. Both copies are kept: the mask preserves
 * length, so raw text can be sliced at the same offsets where a rule needs it.
 */
function extractBlocks(rawSource: string): TestBlock[] {
  const source = maskStringsAndComments(rawSource);
  const blocks: TestBlock[] = [];

  for (const match of source.matchAll(TEST_DECL)) {
    const nameLength = match[2]?.length ?? 0;
    // The name lives inside a string, so the masked copy has blanked it.
    const nameStart = match.index + match[0].length - nameLength - 1;
    const name = rawSource.slice(nameStart, nameStart + nameLength);

    // Start after the arrow, not after the title: `async ({ page }) => {` opens a
    // brace for the destructured fixtures first, and matching that one yields an
    // empty body and a bogus "no assertions" finding.
    const afterTitle = match.index + match[0].length;
    const arrowIndex = source.indexOf('=>', afterTitle);
    const openIndex = source.indexOf('{', arrowIndex === -1 ? afterTitle : arrowIndex);
    if (openIndex === -1) continue;

    let depth = 0;
    let closeIndex = -1;
    for (let i = openIndex; i < source.length; i += 1) {
      const char = source[i];
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          closeIndex = i;
          break;
        }
      }
    }
    if (closeIndex === -1) continue;

    blocks.push({
      name,
      code: source.slice(openIndex, closeIndex + 1),
      raw: rawSource.slice(openIndex, closeIndex + 1),
      line: source.slice(0, match.index).split('\n').length,
    });
  }

  return blocks;
}

/**
 * Flags tests that run green without proving anything.
 *
 * A generated suite trends toward tests that navigate, click, and assert nothing —
 * they pass forever and catch no regression. This is the gate an agent must clear
 * before its output is allowed into the repo.
 */
export function analyzeSpec(source: string): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (const block of extractBlocks(source)) {
    const assertions = (block.code.match(/\bexpect\s*\(/g) ?? []).length;
    const interactions = (
      block.code.match(/\.(click|fill|press|check|selectOption|setInputFiles|type)\s*\(/g) ?? []
    ).length;
    const navigations = (block.code.match(/\.goto\s*\(/g) ?? []).length;

    if (assertions === 0) {
      findings.push({
        kind: 'no-assertion',
        testName: block.name,
        line: block.line,
        detail: 'No expect() call — this test cannot fail on a regression.',
      });
    } else if (navigations > 0 && interactions === 0 && assertions < 2) {
      findings.push({
        kind: 'navigation-only',
        testName: block.name,
        line: block.line,
        detail:
          'Navigates and makes a single assertion with no interaction. Proves the page loads, ' +
          'not that the feature works.',
      });
    }

    // Located in the masked copy so a selector written inside a fixture string is
    // ignored, then read from raw — here the string's contents ARE the code's meaning.
    for (const call of block.code.matchAll(/\.locator\s*\(\s*(['"`])( *)\1/g)) {
      const valueLength = call[2]?.length ?? 0;
      const valueStart = call.index + call[0].length - valueLength - 1;
      const value = block.raw.slice(valueStart, valueStart + valueLength);
      const fragile = /(^|\s|>)\.[\w-]+|nth-child|>\s*div|\[\d+\]/.test(value);
      if (fragile && !/TODO \(Fragile\)/.test(block.raw)) {
        findings.push({
          kind: 'unmarked-fragile-selector',
          testName: block.name,
          line: block.line,
          detail: `CSS selector "${value}" is position/class dependent and is not marked with a TODO (Fragile) comment.`,
        });
      }
    }

    // A test that fails should say what the failure means. "Expected: 200, Received:
    // 404" sends the reader to the source to find out what was being proved, and with
    // several assertions it does not even say which one broke.
    //
    // Deliberately a floor, not a ceiling: one explanatory message per test, and only
    // once a test has more than one assertion — a single assertion is usually
    // explained by the test's own name.
    const explained = (block.code.match(/expect\([^;]*?,\s*['"`]/g) ?? []).length;
    if (assertions > 1 && explained === 0) {
      findings.push({
        kind: 'unexplained-failure',
        testName: block.name,
        line: block.line,
        detail:
          `${assertions} assertions, none explaining what a failure means. Give at least one ` +
          `a message: expect(value, 'why this matters').`,
      });
    }

    if (/waitForTimeout\s*\(/.test(block.code)) {
      findings.push({
        kind: 'banned-wait',
        testName: block.name,
        line: block.line,
        detail: 'waitForTimeout() makes the suite slow and flaky. Use a web-first assertion.',
      });
    }
  }

  return findings;
}

export function formatFindings(file: string, findings: QualityFinding[]): string {
  if (findings.length === 0) return `${file}: OK`;
  return findings
    .map((f) => `${file}:${f.line}  [${f.kind}] ${f.testName}\n    ${f.detail}`)
    .join('\n');
}
