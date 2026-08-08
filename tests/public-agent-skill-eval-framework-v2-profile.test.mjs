import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AGENT_SKILL_EVAL_FRAMEWORK_V2_EXACT_FILES,
  agentSkillEvalFrameworkV2Commands,
  isAgentSkillEvalFrameworkV2Scope,
} from '../scripts/run-agent-skill-eval-framework-v2-profile.mjs';

const expectedFiles = new Set([
  'docs/testing/trainingos-agent-skill-eval-framework-v2.md',
  'lib/agent-skill-evals/trainingos-agent-skill-evals-v2.mjs',
  'tests/fixtures/trainingos_agent_skill_eval_cases_v2.json',
  'tests/test_trainingos_agent_skill_eval_framework_v2.py',
  'tests/trainingos-agent-skill-evals/agent-skill-evals-v2.test.mjs',
]);

test('v2 selector accepts only the exact five private files', () => {
  assert.deepEqual([...AGENT_SKILL_EVAL_FRAMEWORK_V2_EXACT_FILES].sort(), [...expectedFiles].sort());
  assert.equal(isAgentSkillEvalFrameworkV2Scope(expectedFiles), true);
  assert.equal(isAgentSkillEvalFrameworkV2Scope([...expectedFiles, 'netlify.toml']), false);
  assert.equal(isAgentSkillEvalFrameworkV2Scope([...expectedFiles].slice(1)), false);
  const replaced = [...expectedFiles];
  replaced[0] = 'supabase/migrations/20260808999998_not_allowed.sql';
  assert.equal(isAgentSkillEvalFrameworkV2Scope(replaced), false);
});

test('v2 profile executes exactly eight bounded stages', () => {
  assert.deepEqual(agentSkillEvalFrameworkV2Commands.map((item) => item.label), [
    'install',
    'syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const node = agentSkillEvalFrameworkV2Commands.find((item) => item.label === 'focused-node-contracts');
  assert.deepEqual(node?.args, [
    '--test', 'tests/trainingos-agent-skill-evals/agent-skill-evals-v2.test.mjs',
  ]);
  const python = agentSkillEvalFrameworkV2Commands.find((item) => item.label === 'focused-python-contracts');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v', 'tests.test_trainingos_agent_skill_eval_framework_v2',
  ]);
});

test('v2 fixed exact-head counts are locked', () => {
  const source = readFileSync(
    new URL('../scripts/run-agent-skill-eval-framework-v2-profile.mjs', import.meta.url),
    'utf8',
  );
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 14;',
    'const EXPECTED_PYTHON_COUNT = 10;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'agent-skill-eval-framework-v2'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes v2 before inherited generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunAgentSkillEvalFrameworkV2Profile } from './run-agent-skill-eval-framework-v2-profile.mjs';"), true);
  const v2 = router.indexOf('maybeRunAgentSkillEvalFrameworkV2Profile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(v2 >= 0 && fallback > v2);
});

test('v2 public profile contains no external execution command', () => {
  const text = JSON.stringify(agentSkillEvalFrameworkV2Commands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy',
    'supabase db', 'psql', 'playwright', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
