import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SKILL_LIBRARY_SEED_EXACT_FILES,
  skillLibrarySeedCommands,
  isSkillLibrarySeedScope,
} from '../scripts/run-skill-library-seed-profile.mjs';

test('Skill Library seed selector accepts exactly eight private owner files', () => {
  assert.equal(SKILL_LIBRARY_SEED_EXACT_FILES.size, 8);
  assert.equal(isSkillLibrarySeedScope(SKILL_LIBRARY_SEED_EXACT_FILES), true);
  assert.equal(isSkillLibrarySeedScope([...SKILL_LIBRARY_SEED_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isSkillLibrarySeedScope([...SKILL_LIBRARY_SEED_EXACT_FILES].slice(1)), false);
  const replaced = [...SKILL_LIBRARY_SEED_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260811999999_not_allowed.sql';
  assert.equal(isSkillLibrarySeedScope(replaced), false);
});

test('Skill Library seed runs only fixed read/build gates', () => {
  assert.deepEqual(skillLibrarySeedCommands.map((item) => item.label), [
    'install',
    'seed-json-parse',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
});

test('Skill Library seed locks exact counts and compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-skill-library-seed-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 8;',
    'const EXPECTED_NODE_COUNT = 0;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 378;',
    "selectedSuite: 'skill-library-seed'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes Skill Library seed before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunSkillLibrarySeedProfile } from './run-skill-library-seed-profile.mjs';"), true);
  const skillLibrary = router.indexOf('maybeRunSkillLibrarySeedProfile');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(skillLibrary >= 0 && fallback > skillLibrary);
});

test('public Skill Library seed profile contains no network deploy database or arbitrary shell primitive', () => {
  const text = JSON.stringify(skillLibrarySeedCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'payment', 'settlement', 'wallet', 'token movement', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
