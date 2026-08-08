import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AGENT_SKILL_PILOT_EXACT_FILES,
  agentSkillPilotCommands,
  isAgentSkillPilotScope,
  COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES,
  LIVE_CLASSROOM_CONTRACT_SHELL_EXACT_FILES,
} from '../scripts/run-saas-milestone-roadmap-profile.mjs';

test('AgentSkill pilot selector accepts exactly the five owned files', () => {
  assert.equal(AGENT_SKILL_PILOT_EXACT_FILES.size, 5);
  assert.equal(isAgentSkillPilotScope(AGENT_SKILL_PILOT_EXACT_FILES), true);
  assert.equal(
    isAgentSkillPilotScope([...AGENT_SKILL_PILOT_EXACT_FILES, 'netlify.toml']),
    false,
  );
  const missing = [...AGENT_SKILL_PILOT_EXACT_FILES].slice(1);
  assert.equal(isAgentSkillPilotScope(missing), false);
  const replaced = [...AGENT_SKILL_PILOT_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isAgentSkillPilotScope(replaced), false);
});

test('AgentSkill pilot fixed profile runs eight contracts and real repository gates', () => {
  assert.deepEqual(agentSkillPilotCommands.map((item) => item.label), [
    'install',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);

  const python = agentSkillPilotCommands.find((item) => item.label === 'focused-python-contracts');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_agent_skill_pilot_v1',
  ]);

  const build = agentSkillPilotCommands.find((item) => item.label === 'direct-vite-production-build');
  assert.deepEqual(build?.args, ['vite', 'build', '--config', 'vite.config.ts']);

  const postbuild = agentSkillPilotCommands.find((item) => item.label === 'postbuild-copy');
  assert.deepEqual(postbuild?.args, ['scripts/copy-trainingos-marketplace-web.mjs']);

  const bundle = agentSkillPilotCommands.find((item) => item.label === 'bundle-verification');
  assert.deepEqual(bundle?.args, ['run', 'verify:build']);
});

test('AgentSkill pilot profile is isolated from existing product owners', () => {
  for (const file of AGENT_SKILL_PILOT_EXACT_FILES) {
    assert.equal(COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES.has(file), false, file);
    assert.equal(LIVE_CLASSROOM_CONTRACT_SHELL_EXACT_FILES.has(file), false, file);
  }
});

test('AgentSkill pilot uses current canonical migration metadata', () => {
  const source = readFileSync(
    new URL('../scripts/run-saas-milestone-roadmap-profile.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes("suite: 'agent-skill-pilot'"), true);
  assert.equal(source.includes('files: AGENT_SKILL_PILOT_EXACT_FILES'), true);
  assert.equal(source.includes('expectedChangedFileCount: 5'), true);
  assert.equal(source.includes('expectedPythonCount: 8'), true);
  assert.equal(source.includes('expectedMigrationCount: 369'), true);
  assert.equal(source.includes('profile.expectedMigrationCount ?? EXPECTED_MIGRATION_COUNT'), true);
});

test('AgentSkill pilot profile has no deployment network database or arbitrary shell execution', () => {
  const text = JSON.stringify(agentSkillPilotCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'deploy', 'netlify deploy', 'vercel deploy',
    'supabase db', 'psql', 'playwright', 'bash -c', 'sh -c', 'service_role',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
