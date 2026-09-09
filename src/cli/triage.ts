import { readFile } from 'node:fs/promises';
import { AgentAuthError } from '../agents/client.js';
import { triageFailure, type TriageInput } from '../agents/triage.js';

const path = process.argv[2];
if (path === undefined) {
  console.error('usage: npm run triage -- <failure.json>');
  console.error('  failure.json: { testTitle, errorMessage, url?, network? }');
  console.error('  a failing test writes network-summary.json into its report attachments');
  process.exit(2);
}

const input = JSON.parse(await readFile(path, 'utf8')) as TriageInput;

let result;
try {
  result = await triageFailure(input);
} catch (error) {
  if (error instanceof AgentAuthError) {
    console.error(error.message);
    process.exit(2);
  }
  throw error;
}

const { verdict, degraded, costUsd } = result;

if (verdict === null) {
  console.error(`Triage incomplete: ${degraded} ($${costUsd.toFixed(4)})`);
  process.exit(1);
}

console.log(`${verdict.classification} (${verdict.confidence} confidence)`);
console.log(`\n${verdict.summary}\n`);
console.log('Evidence:');
for (const item of verdict.evidence) console.log(`  - ${item}`);
if (verdict.suggestedFix !== null) console.log(`\nSuggested fix:\n  ${verdict.suggestedFix}`);
console.log(`\n$${costUsd.toFixed(4)}`);
