import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizePythonFailureIdentifiers } from '../scripts/run-private-profile.mjs';

test('Python diagnostics expose only failing unittest module identifiers', () => {
  const raw = [
    'test_manifest_ok (test_provider_contract.ProviderContractTests.test_manifest_ok) ... ok',
    'test_gateway_boundary (test_gateway_contract.GatewayContractTests.test_gateway_boundary) ... FAIL',
    'test_evidence_classification (tests.test_evidence_contract.EvidenceContractTests.test_evidence_classification) ... ERROR',
    'AssertionError: private assertion detail',
  ].join('\n');
  assert.deepEqual(
    sanitizePythonFailureIdentifiers(raw),
    ['test_gateway_contract', 'test_evidence_contract'],
  );
});

test('Python diagnostics reject paths, assertions, successes and malformed identifiers', () => {
  const raw = [
    '/home/runner/private/tests/test_secret.py:42',
    'FAIL: test_secret (test_secret.SecretTests.test_secret)',
    'test_success (test_success_contract.SuccessTests.test_success) ... ok',
    'test_bad (test-bad-module.BadTests.test_bad) ... FAIL',
    'private source content',
  ].join('\n');
  assert.deepEqual(sanitizePythonFailureIdentifiers(raw), ['unknown']);
});

test('Python diagnostics deduplicate and cap identifiers', () => {
  const raw = [
    'test_a (test_contract_a.ContractTests.test_a) ... FAIL',
    'test_a_again (test_contract_a.ContractTests.test_a_again) ... ERROR',
    'test_b (test_contract_b.ContractTests.test_b) ... FAIL',
    'test_c (test_contract_c.ContractTests.test_c) ... FAIL',
    'test_d (test_contract_d.ContractTests.test_d) ... FAIL',
    'test_e (test_contract_e.ContractTests.test_e) ... FAIL',
    'test_f (test_contract_f.ContractTests.test_f) ... FAIL',
  ].join('\n');
  assert.deepEqual(sanitizePythonFailureIdentifiers(raw), [
    'test_contract_a',
    'test_contract_b',
    'test_contract_c',
    'test_contract_d',
    'test_contract_e',
  ]);
});
