import assert from 'node:assert/strict';
import test from 'node:test';

import { profileCommands } from '../scripts/run-private-profile-stage3.mjs';

test('teacher-hub reuses the existing profile and includes formal action contracts', () => {
  const commands = profileCommands['teacher-hub'];
  assert.ok(Array.isArray(commands));
  const python = commands.find((item) => item.label === 'python-contract');
  assert.ok(python);
  assert.equal(
    python.args.filter((item) => item === 'tests.test_trainingos_teacher_operations_hub_formal_actions_contract').length,
    1,
  );
  assert.ok(python.args.includes('tests.test_trainingos_teacher_operations_hub_mount_contract'));
  assert.ok(python.args.includes('tests.test_trainingos_teacher_operations_hub_adapter_contract'));
});

test('formal action coverage does not create a one-off validation profile', () => {
  assert.equal(profileCommands['teacher-hub-actions'], undefined);
  assert.equal(profileCommands['teacher-hub-formal-actions'], undefined);
});
