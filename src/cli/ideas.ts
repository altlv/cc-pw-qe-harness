import { readFile } from 'node:fs/promises';
import { formatCatalogue } from '../qe/heuristics.js';
import { formatIdeas, ideasFor, type IdeasInput } from '../qe/test-ideas.js';
import type { PageScan } from '../tools/page-scanner.js';
import type { EndpointShape } from '../tools/schema.js';

const arg = process.argv[2];

if (arg === '--catalogue') {
  console.log(formatCatalogue());
  process.exit(0);
}

if (arg === undefined) {
  console.error('usage: npm run ideas -- <scan.json>     test cases from a saved scan');
  console.error('       npm run ideas -- --catalogue     every heuristic: scripted, generated,');
  console.error('                                        scriptable, or judgement');
  console.error('Make the scan with: npm run scan -- <url> <scan.json>');
  process.exit(2);
}

// Two shapes are on disk: `scan` writes { stack, scan, dictionary }, and older committed
// scans are a bare PageScan. Both are read; `ideasFor` refuses the old one out loud.
const parsed = JSON.parse(await readFile(arg, 'utf8')) as {
  scan?: PageScan;
  dictionary?: EndpointShape[];
  interactive?: unknown;
};

let input: IdeasInput;
if (parsed.scan !== undefined) {
  input = { scan: parsed.scan, dictionary: parsed.dictionary ?? [] };
} else if (Array.isArray(parsed.interactive)) {
  input = { scan: parsed as unknown as PageScan, dictionary: [] };
} else {
  console.error(`${arg} is not a scan — expected the .json that \`npm run scan\` writes`);
  process.exit(2);
}

console.log(formatIdeas(ideasFor(input), arg));
