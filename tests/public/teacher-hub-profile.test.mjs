import test from 'node:test';
import assert from 'node:assert/strict';
import { profileCommands } from '../../scripts/run-private-profile.mjs';

test('Teacher Hub profile excludes unrelated Learning Workspace regression and uses dedicated fixture browser', () => {
  const commands = profileCommands['teacher-hub'];
  const labels = commands.map((item) => item.label);
  assert.equal(labels.includes('learning-workspace-validation'), false);
  assert.equal(labels.includes('deep-links-stale-offline'), false);
  const playwright = commands.find((item) => item.label === 'playwright');
  assert.ok(playwright);
  assert.deepEqual(playwright.args, [
    'playwright',
    'test',
    '--config=tests/trainingos-ui-e2e/teacher-operations-hub.config.ts',
  ]);
  assert.equal(labels.includes('native-validation'), true);
  assert.equal(labels.includes('zero-permission-validation'), true);
  assert.equal(labels.includes('vscode-bundle'), true);
  assert.equal(labels.includes('production-build'), true);
});
