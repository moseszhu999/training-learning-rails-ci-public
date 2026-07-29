import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sanitizeBuildSubstage,
  sanitizeTypeScriptDiagnostics,
} from '../../scripts/sanitize-challenge-web-diagnostics.mjs';

test('sanitizes TypeScript diagnostics without exposing messages', () => {
  const raw = [
    'apps/training-web/src/components/InviteChallengeProduct.tsx(123,45): error TS2345: private diagnostic text',
    '/runner/private/apps/training-web/src/invite-challenge/gateway.ts(9,2): error TS2322: another private diagnostic',
  ].join('\n');
  const result = sanitizeTypeScriptDiagnostics(raw);
  assert.equal(result, 'apps/training-web/src/components/InviteChallengeProduct.tsx:123:TS2345,apps/training-web/src/invite-challenge/gateway.ts:9:TS2322');
  assert.doesNotMatch(result, /private diagnostic|another private/);
});

test('classifies fixed build substages without publishing raw output', () => {
  assert.equal(sanitizeBuildSubstage('node scripts/run-trainingos-learning-workspace-bridge-validation.mjs'), 'learning-workspace-validation');
  assert.equal(sanitizeBuildSubstage('npx vite build --config vite.config.ts'), 'vite-build');
  assert.equal(sanitizeBuildSubstage('unclassified failure'), 'unknown-build-substage');
});
