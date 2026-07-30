import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isLearningAssistanceGovernanceFiles,
  learningAssistanceProfileCommands,
} from '../scripts/run-private-profile-stage9.mjs';

const FILES = Object.freeze([
  'api/integrations/agents/mcp.mjs',
  'docs/architecture/trainingos-learning-assistance-governance-runtime-v1.md',
  'docs/testing/trainingos-learning-assistance-governance-validation-v1.md',
  'lib/trainingos-agent-gateway/learning-assistance-governance.mjs',
  'lib/trainingos-agent-gateway/mcp-learning-assistance-governance-layer.mjs',
  'netlify/functions/trainingos-mcp.mjs',
  'prototypes/trainingos-agent-mvp-v1/learning-assistance-governance.test.mjs',
  'supabase/migrations/20260730150000_trainingos_learning_assistance_schema_v1.sql',
  'supabase/migrations/20260730150100_trainingos_learning_assistance_policy_rpc_v1.sql',
  'supabase/migrations/20260730150200_trainingos_learning_assistance_request_rpc_v1.sql',
  'tests/sql/trainingos_learning_assistance_governance_schema_e2e.sql',
  'tests/test_trainingos_learning_assistance_governance_contract.py',
]);

test('selects only the exact Learning Assistance Governance scope', () => {
  assert.equal(isLearningAssistanceGovernanceFiles(FILES), true);
  assert.equal(isLearningAssistanceGovernanceFiles(FILES.slice(1)), false);
  assert.equal(isLearningAssistanceGovernanceFiles([
    ...FILES,
    'packages/training-challenge/src/runtime.mjs',
  ]), false);
  assert.equal(isLearningAssistanceGovernanceFiles(FILES.map((name) => (
    name.includes('20260730150200')
      ? name.replace('20260730150200', '20260730150300')
      : name
  ))), false);
});

test('fixed profile validates contracts, regressions, builds and database replay', () => {
  const labels = learningAssistanceProfileCommands.map((item) => item.label);
  assert.deepEqual(labels, [
    'install',
    'syntax-governance',
    'syntax-governance-mcp',
    'syntax-vercel-entrypoint',
    'syntax-netlify-entrypoint',
    'node-contract',
    'python-contract',
    'persistent-agent-regression',
    'persistent-python-regression',
    'zero-permission-regression',
    'vscode-classroom-regression',
    'typecheck',
    'vscode-bundle',
    'production-build',
    'database-replay',
  ]);
  const node = learningAssistanceProfileCommands.find((item) => item.label === 'node-contract');
  const python = learningAssistanceProfileCommands.find((item) => item.label === 'python-contract');
  const database = learningAssistanceProfileCommands.find((item) => item.label === 'database-replay');
  assert.equal(node.kind, 'node');
  assert.deepEqual(node.args, [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/learning-assistance-governance.test.mjs',
  ]);
  assert.equal(python.kind, 'python');
  assert.ok(python.args.includes('tests.test_trainingos_learning_assistance_governance_contract'));
  assert.equal(database.executable, 'bash');
  assert.match(database.args[0], /run-learning-assistance-database\.sh$/);
});

test('profile command arguments remain fixed public literals', () => {
  for (const item of learningAssistanceProfileCommands) {
    assert.match(item.label, /^[a-z0-9][a-z0-9-]+$/);
    assert.ok(['npm', 'node', 'python', 'npx', 'bash'].includes(item.executable));
    assert.ok(Object.isFrozen(item.args));
    for (const arg of item.args) {
      assert.equal(typeof arg, 'string');
      assert.equal(arg.includes('${'), false);
      assert.equal(arg.includes('PRIVATE_EXACT_SHA'), false);
    }
  }
});
