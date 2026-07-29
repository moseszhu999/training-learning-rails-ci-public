import assert from 'node:assert/strict';
import test from 'node:test';

import { profileCommands } from '../scripts/run-private-profile.mjs';

test('Challenge Web runs the direct Vite production bundle', () => {
  const commands = profileCommands['challenge-web'];
  assert.deepEqual(commands.map((item) => item.label), [
    'install',
    'python-contract',
    'typecheck',
    'production-build',
    'playwright-browser',
    'playwright',
  ]);

  const build = commands.find((item) => item.label === 'production-build');
  assert.equal(build.executable, 'npx');
  assert.deepEqual(build.args, ['vite', 'build', '--config', 'vite.config.ts']);
  assert.equal(
    commands.some((item) => item.executable === 'npm' && item.args.join(' ') === 'run build'),
    false,
  );
});

test('Challenge Web retains its owned contract and browser stages', () => {
  const commands = profileCommands['challenge-web'];
  assert.ok(commands.some((item) => item.label === 'python-contract'));
  assert.ok(commands.some((item) => item.label === 'typecheck'));
  assert.ok(commands.some((item) => item.label === 'playwright-browser'));
  assert.ok(commands.some((item) => item.label === 'playwright'));
});
