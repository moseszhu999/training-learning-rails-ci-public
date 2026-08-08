import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_POSTCLASS_EVIDENCE_EXACT_FILES,
  liveClassroomPostclassEvidenceCommands,
  isLiveClassroomPostclassEvidenceScope,
} from '../scripts/run-live-classroom-postclass-evidence-current-main-profile.mjs';

test('selector accepts only the three post-class evidence files', () => {
  assert.equal(LIVE_CLASSROOM_POSTCLASS_EVIDENCE_EXACT_FILES.size, 3);
  assert.equal(isLiveClassroomPostclassEvidenceScope(LIVE_CLASSROOM_POSTCLASS_EVIDENCE_EXACT_FILES), true);
  assert.equal(isLiveClassroomPostclassEvidenceScope([...LIVE_CLASSROOM_POSTCLASS_EVIDENCE_EXACT_FILES, 'netlify.toml']), false);
});

test('profile runs eight privacy/truth contracts and build gates', () => {
  assert.deepEqual(liveClassroomPostclassEvidenceCommands.map((item) => item.label), [
    'install', 'focused-python-contracts', 'typecheck', 'direct-vite-production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  assert.deepEqual(liveClassroomPostclassEvidenceCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_live_classroom_postclass_evidence_v1']);
});

test('fixed counts and zero-migration contract remain locked', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-postclass-evidence-current-main-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 3;',
    'const EXPECTED_NODE_COUNT = 0;',
    'const EXPECTED_PYTHON_COUNT = 8;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'live-classroom-postclass-evidence-current-main'",
  ]) assert.equal(source.includes(token), true, token);
});

test('validation profile contains no media/provider/network/formal-write execution primitive', () => {
  const text = JSON.stringify(liveClassroomPostclassEvidenceCommands).toLowerCase();
  for (const forbidden of ['curl', 'wget', 'ssh', 'tencent', 'createroom', 'joinclass', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql', 'playwright']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
