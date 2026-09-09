export type FindingKind =
  'no-assertion' | 'navigation-only' | 'unmarked-fragile-selector' | 'banned-wait';

export interface QualityFinding {
  kind: FindingKind;
  testName: string;
  line: number;
  detail: string;
}

interface TestBlock {
  name: string;
  body: string;
  line: number;
}

const TEST_DECL = /\btest(?:\.(?:only|skip|fixme))?\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

/** Body of a test callback, found by matching braces from the declaration. */
function extractBlocks(source: string): TestBlock[] {
  const blocks: TestBlock[] = [];
  for (const match of source.matchAll(TEST_DECL)) {
    const name = match[2] ?? '';
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
      body: source.slice(openIndex, closeIndex + 1),
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
    const assertions = (block.body.match(/\bexpect\s*\(/g) ?? []).length;
    const interactions = (
      block.body.match(/\.(click|fill|press|check|selectOption|setInputFiles|type)\s*\(/g) ?? []
    ).length;
    const navigations = (block.body.match(/\.goto\s*\(/g) ?? []).length;

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

    for (const selector of block.body.matchAll(/\.locator\s*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      const value = selector[2] ?? '';
      const fragile = /(^|\s|>)\.[\w-]+|nth-child|>\s*div|\[\d+\]/.test(value);
      if (fragile && !/TODO \(Fragile\)/.test(block.body)) {
        findings.push({
          kind: 'unmarked-fragile-selector',
          testName: block.name,
          line: block.line,
          detail: `CSS selector "${value}" is position/class dependent and is not marked with a TODO (Fragile) comment.`,
        });
      }
    }

    if (/waitForTimeout\s*\(/.test(block.body)) {
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
