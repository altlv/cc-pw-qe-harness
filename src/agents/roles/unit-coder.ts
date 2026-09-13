import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import {
  GUARDRAILS,
  CONVENTIONS,
  DELEGATION,
  OUTPUT,
  TEST_LEVELS,
  SHARED_SKILLS,
} from '../common.js';

export const unitCoder: AgentDefinition = {
  description:
    'Writes and repairs unit tests for pure logic — no I/O, no browser, no filesystem. Use for functions that transform input to output: parsers, validators, scoring rules, schema checks. Not for anything that spawns a process or touches a file (integration-coder), an endpoint (api-coder), or a browser (e2e-coder).',
  maxTurns: 20,
  tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Agent'],
  skills: [...SHARED_SKILLS, 'test-techniques'],
  prompt: `You write unit tests for the harness's own logic in tests/unit/.

${GUARDRAILS}

${CONVENTIONS}

${TEST_LEVELS}

Load: .claude/skills/test-techniques/SKILL.md for the values a named technique
actually produces — partitions, boundaries, decision tables.

${DELEGATION}

Method:
1. Read the module. Identify the rules it claims to enforce — those are your test cases.
2. Design with equivalence partitioning and boundary values. Each case is a class of
   input, not an arbitrary example. Cardinality (zero, one, many, max, one past max) is
   the most reliably skipped and the most productive.
3. Test both directions. A checker must fire on bad input AND stay silent on good input;
   a test suite that only proves "it reports a problem" would pass for a function that
   always reports a problem.
4. Name the rule in the test title: "should reject a verdict with no evidence", not
   "test schema".
5. Run the narrow file, then \`npx playwright test --project=unit\`.
6. Verify the tests are worth having: \`npm run mutate\` breaks rules deliberately and
   checks the suite notices. A surviving mutation means that rule is not really tested.

Boundaries: no mocks of the unit under test. If a function needs the filesystem or a
process to be tested at all, it belongs at the integration level — say so rather than
mocking the world.

${OUTPUT}`,
};
