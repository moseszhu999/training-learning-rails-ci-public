import assert from 'node:assert/strict';
import test from 'node:test';

import { profileCommands } from '../scripts/run-private-profile-stage15.mjs';
import { profileAllowlist } from '../scripts/verify-private-scope.mjs';

const todayMasterDetailFiles = [
  'apps/training-web/src/components/TrainingOsTeacherOperationsHub.tsx',
  'apps/training-web/src/lib/trainingos-teacher-operations-hub-view-model.ts',
  'apps/training-web/src/lib/trainingos-teacher-operations-hub-adapter.ts',
  'apps/training-web/src/trainingos-teacher-operations-hub.css',
  'apps/training-web/src/lib/trainingos-today-workspace-selection.ts',
  'tests/test_trainingos_today_master_detail_v1.py',
  'docs/product/trainingos-today-master-detail-v1.md',
];

function isTeacherHubAllowed(path) {
  return profileAllowlist['teacher-hub'].some((rule) => rule.test(path));
}

test('teacher-hub allowlist accepts exactly the Today Master-Detail owned paths', () => {
  for (const path of todayMasterDetailFiles) {
    assert.equal(isTeacherHubAllowed(path), true, path);
  }

  for (const path of [
    'apps/training-web/src/components/TrainingOsStructuredAgentCommand.tsx',
    'apps/training-web/src/components/TrainingOsAdvancedManagementSurface.tsx.bak',
    'tests/trainingos-ui-e2e/today-master-detail.spec.ts',
    'supabase/migrations/20260803170000_today_master_detail.sql',
  ]) {
    assert.equal(isTeacherHubAllowed(path), false, path);
  }
});

test('teacher-hub runs the fixed Today Master-Detail focused contract', () => {
  const commands = profileCommands['teacher-hub'];
  const selected = commands.filter((item) => item.label === 'python-today-master-detail');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].executable, 'python');
  assert.equal(selected[0].kind, 'python');
  assert.deepEqual(selected[0].args, [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_today_master_detail_v1',
  ]);
});

test('Today Master-Detail stays in the existing teacher-hub profile before runtime gates', () => {
  const labels = profileCommands['teacher-hub'].map((item) => item.label);
  const todayIndex = labels.indexOf('python-today-master-detail');
  const roleContractsIndex = labels.indexOf('role-contracts');
  assert.ok(todayIndex >= 0);
  assert.ok(roleContractsIndex >= 0);
  assert.ok(todayIndex < roleContractsIndex);

  for (const label of [
    'typecheck',
    'native-validation',
    'zero-permission-validation',
    'vscode-bundle',
    'production-build',
    'playwright',
  ]) {
    assert.ok(labels.includes(label), label);
  }

  assert.equal(Object.hasOwn(profileCommands, 'today-master-detail'), false);
});
