import assert from 'node:assert/strict';
import test from 'node:test';

import { profileCommands } from '../scripts/run-private-profile-stage14.mjs';

test('teacher-hub exposes 24 fixed granular mount and acceptance labels', () => {
  const commands = profileCommands['teacher-hub'];
  const granular = commands.filter((item) => item.label.startsWith('mount-') || item.label.startsWith('accept-'));
  assert.equal(granular.length, 24);
  assert.equal(commands.some((item) => item.label === 'python-mount'), false);
  assert.equal(commands.some((item) => item.label === 'python-acceptance'), false);
  assert.equal(new Set(granular.map((item) => item.label)).size, 24);
  for (const command of granular) {
    assert.equal(command.executable, 'python');
    assert.equal(command.kind, 'python');
    assert.deepEqual(command.args.slice(0, 3), ['-m', 'unittest', '-v']);
    assert.match(command.args[3], /^tests\.test_trainingos_teacher_operations_hub_/);
  }
});

test('teacher-hub keeps adapter formal-actions and failure-semantics modules', () => {
  const labels = profileCommands['teacher-hub'].map((item) => item.label);
  for (const label of ['python-adapter', 'python-formal-actions', 'python-failure-semantics']) {
    assert.ok(labels.includes(label), label);
  }
});
