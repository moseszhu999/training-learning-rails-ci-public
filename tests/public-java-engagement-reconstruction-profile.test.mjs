import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JAVA_ENGAGEMENT_RECONSTRUCTION_EXACT_FILES,
  javaEngagementReconstructionCommands,
  isJavaEngagementReconstructionScope,
} from '../scripts/run-java-engagement-reconstruction-profile.mjs';

test('Java engagement reconstruction selector accepts exactly five private files', () => {
  assert.equal(JAVA_ENGAGEMENT_RECONSTRUCTION_EXACT_FILES.size, 5);
  assert.equal(isJavaEngagementReconstructionScope(JAVA_ENGAGEMENT_RECONSTRUCTION_EXACT_FILES), true);
  assert.equal(isJavaEngagementReconstructionScope([...JAVA_ENGAGEMENT_RECONSTRUCTION_EXACT_FILES, 'netlify.toml']), false);
  const missing = [...JAVA_ENGAGEMENT_RECONSTRUCTION_EXACT_FILES].slice(1);
  assert.equal(isJavaEngagementReconstructionScope(missing), false);
  const replaced = [...JAVA_ENGAGEMENT_RECONSTRUCTION_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isJavaEngagementReconstructionScope(replaced), false);
});

test('Java engagement reconstruction profile runs exact contracts and build gates', () => {
  assert.deepEqual(javaEngagementReconstructionCommands.map((item) => item.label), [
    'install', 'contract-syntax', 'focused-node-contracts', 'focused-python-contracts',
    'typecheck', 'direct-vite-production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  assert.deepEqual(javaEngagementReconstructionCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'packages/training-industry-role-pack-core/test/engagement-reconstruction.test.mjs']);
  assert.deepEqual(javaEngagementReconstructionCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_java_engagement_reconstruction_v1']);
});

test('Java engagement reconstruction profile locks 5 files 10 node 8 python and migration metadata 371', () => {
  const source = readFileSync(new URL('../scripts/run-java-engagement-reconstruction-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 10;',
    'const EXPECTED_PYTHON_COUNT = 8;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
    "selectedSuite: 'java-engagement-reconstruction'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes reconstruction after Demand Scope Delivery Review and before fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunJavaEngagementReconstructionProfile } from './run-java-engagement-reconstruction-profile.mjs';"), true);
  const review = router.indexOf('maybeRunDemandScopeDeliveryReviewProfile(input)');
  const reconstruction = router.indexOf('maybeRunJavaEngagementReconstructionProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(review >= 0 && reconstruction > review && fallback > reconstruction);
});

test('public reconstruction profile has no database provider deployment or arbitrary shell primitive', () => {
  const text = JSON.stringify(javaEngagementReconstructionCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'tencent', 'createroom', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
