import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync(new URL('../scripts/run-workbuddy-mcp-client-path-profile.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

test('WorkBuddy MCP client path profile is fixed to three private files', () => {
  for (const marker of [
    'apps/training-web/src/components/TrainingOsAdvancedManagementSurface.tsx',
    'docs/verification/trainingos-workbuddy-mcp-acceptance-v1.md',
    'tests/test_trainingos_workbuddy_mcp_acceptance_contract.py',
    'files.length === EXACT_FILES.size',
    'files.every((file) => EXACT_FILES.has(file))',
  ]) assert.match(profile, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('WorkBuddy MCP client path profile exposes only fixed Python substage labels', () => {
  for (const marker of [
    "command('syntax-netlify-mcp'",
    "command('syntax-vercel-mcp'",
    "command('python-adapter'",
    'test_workbuddy_acceptance_uses_the_existing_netlify_mcp_adapter',
    "command('python-composition'",
    'test_netlify_and_vercel_keep_one_canonical_mcp_composition',
    "command('python-shortcut'",
    'test_workbuddy_acceptance_restores_the_real_exercise_agent_shortcut',
    "command('python-boundary'",
    'test_workbuddy_acceptance_is_ordinary_user_and_non_production_only',
    "print('Ran 1 test')",
    "command('typecheck'",
    "command('production-build'",
    'Number(input.expectedPythonCount) === 4',
    'pythonTests === 4',
  ]) assert.match(profile, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(profile, /pytest/);
  assert.doesNotMatch(profile, /Traceback/);
});

test('generic-owned router selects WorkBuddy fixed profile before broad fallback', () => {
  assert.match(router, /maybeRunWorkBuddyMcpClientPathProfile/);
  const fixed = router.indexOf('const workBuddyMcpClientPath');
  const base = router.indexOf('const result = await runBaseProfile');
  assert.ok(fixed >= 0 && base > fixed);
});
