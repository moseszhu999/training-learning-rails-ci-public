import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/run-main-release-gate.mjs', import.meta.url), 'utf8');

test('main-release reports only fixed build substage labels', () => {
  for (const label of [
    'build-native-validation',
    'build-zero-permission',
    'build-learning-workspace',
    'build-vscode-bundle',
    'build-vite-production',
  ]) {
    assert.match(source, new RegExp(`'${label}'`));
  }

  assert.match(
    source,
    /if \(!result\.ok\) recordFailure\(label, result, label\);/,
    'a failed build must expose its fixed allowlisted label as the sanitized failure stage',
  );
  assert.doesNotMatch(
    source,
    /recordFailure\(label, result, 'production-build'\)/,
    'the generic production-build stage must not hide the actionable fixed substage',
  );
});
