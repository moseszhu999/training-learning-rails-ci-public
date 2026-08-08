import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AGENT_SKILL_EVAL_EXACT_FILES,
  agentSkillEvalCommands,
  isAgentSkillEvalScope,
  AGENT_SKILL_PILOT_EXACT_FILES,
  COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES,
  LIVE_CLASSROOM_CONTRACT_SHELL_EXACT_FILES,
} from '../scripts/run-saas-milestone-roadmap-profile.mjs';

test('AgentSkill eval selector accepts exactly the five stacked eval files', () => {
  assert.equal(AGENT_SKILL_EVAL_EXACT_FILES.size, 5);
  assert.equal(isAgentSkillEvalScope(AGENT_SKILL_EVAL_EXACT_FILES), true);
  assert.equal(isAgentSkillEvalScope([...AGENT_SKILL_EVAL_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isAgentSkillEvalScope([...AGENT_SKILL_EVAL_EXACT_FILES].slice(1)), false);
  const replaced = [...AGENT_SKILL_EVAL_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999998_not_allowed.sql';
  assert.equal(isAgentSkillEvalScope(replaced), false);
});

test('AgentSkill eval fixed profile runs 10 Node, 8 Python and repository gates', () => {
  assert.deepEqual(agentSkillEvalCommands.map((item) => item.label), [
    'install',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const node = agentSkillEvalCommands.find((item) => item.label === 'focused-node-contracts');
  assert.deepEqual(node?.args, [
    '--test', 'tests/trainingos-agent-skill-evals/agent-skill-evals.test.mjs',
  ]);
  const python = agentSkillEvalCommands.find((item) => item.label === 'focused-python-contracts');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_agent_skill_eval_pack_v1',
  ]);
});

test('AgentSkill eval profile is isolated from AgentSkill source and active product owners', () => {
  for (const file of AGENT_SKILL_EVAL_EXACT_FILES) {
    assert.equal(AGENT_SKILL_PILOT_EXACT_FILES.has(file), false, file);
    assert.equal(COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES.has(file), false, file);
    assert.equal(LIVE_CLASSROOM_CONTRACT_SHELL_EXACT_FILES.has(file), false, file);
  }
});

test('AgentSkill eval profile locks current test counts and migration metadata', () => {
  const source = readFileSync(
    new URL('../scripts/run-saas-milestone-roadmap-profile.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes("suite: 'agent-skill-eval-pack'"), true);
  assert.equal(source.includes('files: AGENT_SKILL_EVAL_EXACT_FILES'), true);
  assert.equal(source.includes('expectedChangedFileCount: 5'), true);
  assert.equal(source.includes('expectedNodeCount: 10'), true);
  assert.equal(source.includes('expectedPythonCount: 8'), true);
  assert.equal(source.includes('expectedMigrationCount: 369'), true);
});

test('AgentSkill eval public profile has no deployment network database or browser execution', () => {
  const text = JSON.stringify(agentSkillEvalCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'deploy', 'netlify deploy', 'vercel deploy',
    'supabase db', 'psql', 'playwright', 'bash -c', 'sh -c',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
