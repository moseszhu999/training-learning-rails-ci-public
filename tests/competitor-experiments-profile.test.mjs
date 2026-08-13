import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETITOR_EXPERIMENT_PROFILES,
  resolveCompetitorExperimentProfile,
} from '../scripts/run-competitor-experiments-profile.mjs';

const byId = (id) => COMPETITOR_EXPERIMENT_PROFILES.find((profile) => profile.id === id);

const syntaxLabel = Object.freeze({
  'assistance-aware-roleplay': 'roleplay-syntax',
  'roleplay-experience': 'roleplay-experience-syntax',
  'verified-skill-evidence': 'verified-skill-syntax',
  'expert-to-skill-ingestion': 'expert-skill-syntax',
});

test('publishes exactly four fixed competitor experiment profiles', () => {
  assert.deepEqual(COMPETITOR_EXPERIMENT_PROFILES.map((profile) => profile.id), [
    'assistance-aware-roleplay',
    'roleplay-experience',
    'verified-skill-evidence',
    'expert-to-skill-ingestion',
  ]);
  assert.deepEqual(COMPETITOR_EXPERIMENT_PROFILES.map((profile) => profile.expectedNodeCount), [9, 10, 9, 8]);
  assert.deepEqual(COMPETITOR_EXPERIMENT_PROFILES.map((profile) => profile.exactFiles.size), [4, 5, 4, 4]);
});

test('roleplay selector accepts only its exact four-file scope', () => {
  const profile = byId('assistance-aware-roleplay');
  assert.equal(resolveCompetitorExperimentProfile([...profile.exactFiles])?.id, profile.id);
  assert.equal(resolveCompetitorExperimentProfile([...profile.exactFiles, 'README.md']), null);
  assert.equal(resolveCompetitorExperimentProfile([...profile.exactFiles].slice(1)), null);
});

test('roleplay experience selector accepts only its exact five-file scope', () => {
  const profile = byId('roleplay-experience');
  assert.equal(resolveCompetitorExperimentProfile([...profile.exactFiles])?.id, profile.id);
  assert.equal(resolveCompetitorExperimentProfile([...profile.exactFiles, 'apps/training-web/src/App.tsx']), null);
  assert.equal(resolveCompetitorExperimentProfile([...profile.exactFiles].slice(1)), null);
});

test('verified skill selector accepts only its exact four-file scope', () => {
  const profile = byId('verified-skill-evidence');
  assert.equal(resolveCompetitorExperimentProfile([...profile.exactFiles])?.id, profile.id);
  const tampered = [...profile.exactFiles];
  tampered[0] = 'docs/architecture/not-the-owned-file.md';
  assert.equal(resolveCompetitorExperimentProfile(tampered), null);
});

test('expert-to-skill selector accepts only its exact four-file scope', () => {
  const profile = byId('expert-to-skill-ingestion');
  assert.equal(resolveCompetitorExperimentProfile([...profile.exactFiles])?.id, profile.id);
});

test('migration paths are rejected even if supplied alongside an otherwise exact scope', () => {
  const profile = byId('roleplay-experience');
  assert.equal(resolveCompetitorExperimentProfile([
    ...profile.exactFiles,
    'supabase/migrations/20260813000000_forbidden.sql',
  ]), null);
});

test('each fixed profile runs only sealed install/syntax/focused-test/typecheck/build checks', () => {
  for (const profile of COMPETITOR_EXPERIMENT_PROFILES) {
    assert.deepEqual(profile.commands.map((item) => item.label), [
      'install',
      syntaxLabel[profile.id],
      'focused-node-contracts',
      'repository-typecheck',
      'direct-vite-production-build',
      'postbuild-copy',
      'bundle-verification',
    ]);
    assert.equal(profile.commands.find((item) => item.label === 'focused-node-contracts').kind, 'node');
    assert.equal(profile.commands.find((item) => item.label === 'focused-node-contracts').executable, 'node');
  }
});
