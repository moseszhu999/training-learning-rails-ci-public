import assert from 'node:assert/strict';
import test from 'node:test';

import { profileCommands } from '../scripts/run-private-profile-stage12.mjs';

const expected = new Map([
  ['python-mount-acceptance', 'tests.test_trainingos_teacher_operations_hub_mount_contract'],
  ['python-adapter', 'tests.test_trainingos_teacher_operations_hub_adapter_contract'],
  ['python-formal-actions', 'tests.test_trainingos_teacher_operations_hub_formal_actions_contract'],
  ['python-failure-semantics', 'tests.test_trainingos_teacher_hub_failure_semantics_v1'],
]);

test('teacher-hub Python modules use fixed public-safe failure labels', () => {
  const commands = profileCommands['teacher-hub'];
  assert.equal(commands.some((item) => item.label === 'python-contract'), false);
  for (const [label, moduleName] of expected) {
    const command = commands.find((item) => item.label === label);
    assert.ok(command, label);
    assert.deepEqual(command.args, ['-m', 'unittest', '-v', moduleName]);
    assert.equal(command.kind, 'python');
  }
});

test('splitting diagnostics does not add or remove Teacher Hub Python modules', () => {
  const modules = profileCommands['teacher-hub']
    .filter((item) => item.kind === 'python')
    .map((item) => item.args.at(-1));
  assert.deepEqual(modules, [...expected.values()]);
});
