import assert from 'node:assert/strict';
import test from 'node:test';

import { profileCommands } from '../scripts/run-private-profile-stage13.mjs';

test('teacher-hub separates mount and acceptance suites without changing coverage', () => {
  const commands = profileCommands['teacher-hub'];
  assert.equal(commands.some((item) => item.label === 'python-mount-acceptance'), false);

  const mount = commands.find((item) => item.label === 'python-mount');
  const acceptance = commands.find((item) => item.label === 'python-acceptance');
  assert.ok(mount);
  assert.ok(acceptance);
  assert.deepEqual(mount.args, [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_teacher_operations_hub_mount_contract.TeacherOperationsHubMountContractTest',
  ]);
  assert.deepEqual(acceptance.args, [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_teacher_operations_hub_acceptance_contract',
  ]);
});

test('other fixed Teacher Hub Python labels remain present', () => {
  const labels = profileCommands['teacher-hub']
    .filter((item) => item.kind === 'python')
    .map((item) => item.label);
  assert.deepEqual(labels, [
    'python-mount',
    'python-acceptance',
    'python-adapter',
    'python-formal-actions',
    'python-failure-semantics',
  ]);
});
