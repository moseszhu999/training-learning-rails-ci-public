import assert from 'node:assert/strict';
import test from 'node:test';

import { profileCommands } from '../scripts/run-private-profile-stage11.mjs';

const failureSemanticsContract = 'tests.test_trainingos_teacher_hub_failure_semantics_v1';

test('teacher-hub reuses the existing profile and includes failure-semantics contract', () => {
  const commands = profileCommands['teacher-hub'];
  assert.ok(Array.isArray(commands));
  const python = commands.find((item) => item.label === 'python-contract');
  assert.ok(python);
  assert.equal(
    python.args.filter((item) => item === failureSemanticsContract).length,
    1,
  );
  assert.ok(python.args.includes('tests.test_trainingos_teacher_operations_hub_mount_contract'));
  assert.ok(python.args.includes('tests.test_trainingos_teacher_operations_hub_adapter_contract'));
  assert.ok(python.args.includes('tests.test_trainingos_teacher_operations_hub_formal_actions_contract'));
});

test('failure semantics does not create a one-off validation profile', () => {
  assert.equal(profileCommands['teacher-hub-failure-semantics'], undefined);
  assert.equal(profileCommands['teacher-hub-owner-gap'], undefined);
});
