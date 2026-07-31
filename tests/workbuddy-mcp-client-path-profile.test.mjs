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

test('WorkBuddy MCP client path profile runs bounded fixed validation', () => {
  for (const marker of [
    "command('syntax-netlify-mcp'",
    'netlify/functions/trainingos-mcp.mjs',
    "command('syntax-vercel-mcp'",
    'api/integrations/agents/mcp.mjs',
    "command('python-contract'",
    'tests/test_trainingos_workbuddy_mcp_acceptance_contract.py',
    "command('typecheck'",
    "command('production-build'",
    'Number(input.expectedNodeCount) === 0',
    'Number(input.expectedPythonCount) === 4',
    'pythonTests === 4',
  ]) assert.match(profile, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('generic-owned router selects WorkBuddy fixed profile before broad fallback', () => {
  assert.match(router, /maybeRunWorkBuddyMcpClientPathProfile/);
  const fixed = router.indexOf('const workBuddyMcpClientPath');
  const base = router.indexOf('const result = await runBaseProfile');
  assert.ok(fixed >= 0 && base > fixed);
});
