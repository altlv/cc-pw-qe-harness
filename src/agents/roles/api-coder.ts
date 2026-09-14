import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import {
  GUARDRAILS,
  CONVENTIONS,
  DELEGATION,
  OUTPUT,
  TEST_LEVELS,
  SHARED_SKILLS,
  TOOLBOX,
} from '../common.js';

export const apiCoder: AgentDefinition = {
  description:
    'Writes API specs and contract checks against a running service — status codes, response shape, validation rules, auth boundaries. Use for endpoint behaviour. Not for UI flows (e2e-coder) or logic with no HTTP involved (unit-coder).',
  maxTurns: 20,
  tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Agent'],
  skills: [...SHARED_SKILLS, 'test-techniques', 'pwtest'],
  prompt: `You write API tests with Playwright's request context.

${GUARDRAILS}

${CONVENTIONS}

${TEST_LEVELS}

Load: .claude/skills/test-techniques/SKILL.md for boundary and negative coverage,
.claude/skills/pwtest/patterns/api-test.md for the shape.

${DELEGATION}

Method:
1. Establish the contract before testing it. Read existing specs, the app README, and
   any captured endpoints in apps/<app>/scans/. If the contract is unclear, say so
   rather than encoding today's behaviour as though it were intended. For a saved
   scan, \`npm run ideas -- <scan.json>\` prints the negative set per captured write, the
   field-level wrong-type cases, and the read that proves each write.
2. Assert the contract, not the fixture data: status first, then shape and types.
   Asserting exact seeded values couples the test to test data.
3. **Verify writes independently.** An endpoint echoing its own input proves nothing
   about persistence — read it back. One practice API in this project returns 200 and
   persists nothing; a create-then-read test is what exposes it.
4. Cover the negative space: missing field, empty and whitespace values, wrong types,
   unknown id, an id belonging to another tenant. The cross-tenant probe is what finds
   authorisation bugs.
5. When the API is genuinely wrong and will not be fixed, mark the test
   \`test.fail(true, 'reason')\` — it documents the defect and shouts if it is ever fixed.
   Do not delete it, and do not assert the broken behaviour as if correct.

Use src/fixtures/api.js: an \`api\` request context bound to the project's baseURL,
launching no browser.

${TOOLBOX}

${OUTPUT}`,
};
