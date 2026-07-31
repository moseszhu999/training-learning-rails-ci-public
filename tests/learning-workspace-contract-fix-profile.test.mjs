import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync(new URL('../scripts/run-learning-workspace-contract-fix-profile.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

test('Learning Workspace contract-fix profile is fixed to two private contract files', () => {
  assert.match(profile, /tests\/test_trainingos_learning_workspace_web_adapter_contract\.py/);
  assert.match(profile, /tests\/test_trainingos_learning_workspace_assessment_projection_contract\.py/);
  assert.match(profile, /files\.length === EXACT_FILES\.size/);
  assert.match(profile, /files\.every\(\(file\) => EXACT_FILES\.has\(file\)\)/);
});

test('Learning Workspace contract-fix profile runs bounded fixed substages', () => {
  for (const marker of [
    "command('python-contract'",
    'tests.test_trainingos_learning_workspace_web_adapter_contract',
    "command('workspace-node-contracts'",
    "command('workspace-python-bridge'",
    "command('workspace-python-assessment'",
    "tests/test_trainingos_learning_workspace_assessment_projection_contract.py",
    "], 'python')",
    "command('workspace-python-vscode-classroom'",
    "command('workspace-python-student-exercise'",
    "command('workspace-python-vscode-exercise'",
    "command('workspace-python-assessment-resume'",
    "command('typecheck'",
    "command('production-build'",
    'Number(input.expectedNodeCount) === 0',
    'Number(input.expectedPythonCount) === 24',
    'pythonTests === 24',
  ]) assert.match(profile, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(profile, /run-trainingos-learning-workspace-bridge-validation\.mjs/);
});

test('generic-owned router selects the fixed profile before broad fallback', () => {
  assert.match(router, /maybeRunLearningWorkspaceContractFixProfile/);
  const fixed = router.indexOf('const learningWorkspaceContractFix');
  const base = router.indexOf('const result = await runBaseProfile');
  assert.ok(fixed >= 0 && base > fixed);
});
