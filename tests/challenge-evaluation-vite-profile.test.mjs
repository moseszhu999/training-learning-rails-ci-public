import assert from 'node:assert/strict';
import test from 'node:test';

import {
  challengeEvaluationProfileCommands,
  isChallengeEvaluationFiles,
} from '../scripts/run-private-profile.mjs';

test('evaluation routing stays within the owned Challenge package', () => {
  assert.equal(isChallengeEvaluationFiles([
    'packages/training-challenge-evaluation/index.mjs',
    'packages/training-challenge-packs/ai_evidence_audit_v1/pack.mjs',
    'lib/trainingos-agent-gateway/challenge-evaluation-runtime.mjs',
  ]), true);
  assert.equal(isChallengeEvaluationFiles([
    'packages/training-challenge-evaluation/index.mjs',
    'packages/training-challenge/src/runtime.mjs',
  ]), false);
  assert.equal(isChallengeEvaluationFiles([
    'packages/training-challenge-proof/src/index.mjs',
  ]), false);
});

test('evaluation runs the direct Vite production bundle', () => {
  assert.deepEqual(challengeEvaluationProfileCommands.map((item) => item.label), [
    'install',
    'syntax-evaluation',
    'syntax-pack',
    'syntax-gateway',
    'node-contract',
    'typecheck',
    'production-build',
  ]);
  const build = challengeEvaluationProfileCommands.find((item) => item.label === 'production-build');
  assert.equal(build.executable, 'npx');
  assert.deepEqual(build.args, ['vite', 'build', '--config', 'vite.config.ts']);
  assert.equal(challengeEvaluationProfileCommands.some((item) => item.executable === 'npm' && item.args.join(' ') === 'run build'), false);
});

test('evaluation commands are fixed data', () => {
  for (const item of challengeEvaluationProfileCommands) {
    assert.equal(typeof item.label, 'string');
    assert.equal(typeof item.executable, 'string');
    assert.ok(Array.isArray(item.args));
  }
});
