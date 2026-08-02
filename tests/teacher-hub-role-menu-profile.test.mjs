import assert from 'node:assert/strict';
import test from 'node:test';

import { profileCommands } from '../scripts/run-private-profile-stage15.mjs';

const expected = new Map([
  ['python-role-menu-content', 'tests.test_trainingos_role_menu_content_permissions_v1'],
  ['python-advanced-settings', 'tests.test_trainingos_advanced_settings'],
  ['python-risk-intervention', 'tests.test_trainingos_risk_intervention_ui_contract'],
  ['python-zero-permission-core', 'tests.test_trainingos_zero_permission_bridge_core_contract'],
]);

test('teacher-hub extends the existing profile with fixed role menu permission contracts', () => {
  const commands = profileCommands['teacher-hub'];
  assert.ok(Array.isArray(commands));

  const selected = commands.filter((item) => expected.has(item.label));
  assert.equal(selected.length, expected.size);
  assert.equal(new Set(selected.map((item) => item.label)).size, expected.size);

  for (const command of selected) {
    assert.equal(command.executable, 'python');
    assert.equal(command.kind, 'python');
    assert.deepEqual(command.args, [
      '-m',
      'unittest',
      '-v',
      expected.get(command.label),
    ]);
  }
});

test('role menu contracts remain inside teacher-hub before runtime role and build gates', () => {
  const labels = profileCommands['teacher-hub'].map((item) => item.label);
  const roleContractsIndex = labels.indexOf('role-contracts');
  assert.ok(roleContractsIndex >= 0);

  for (const label of expected.keys()) {
    const index = labels.indexOf(label);
    assert.ok(index >= 0, label);
    assert.ok(index < roleContractsIndex, label);
  }

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
});

test('no second profile is introduced for role menu permissions', () => {
  assert.equal(Object.hasOwn(profileCommands, 'role-menu-permissions'), false);
  assert.equal(Object.hasOwn(profileCommands, 'teacher-role-menu'), false);
});
