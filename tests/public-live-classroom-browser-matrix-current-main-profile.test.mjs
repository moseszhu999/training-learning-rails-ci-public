import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_BROWSER_MATRIX_EXACT_FILES,
  liveClassroomBrowserMatrixCommands,
  isLiveClassroomBrowserMatrixScope,
} from '../scripts/run-live-classroom-browser-matrix-current-main-profile.mjs';

test('selector accepts only the five browser-matrix files', () => {
  assert.equal(LIVE_CLASSROOM_BROWSER_MATRIX_EXACT_FILES.size, 5);
  assert.equal(isLiveClassroomBrowserMatrixScope(LIVE_CLASSROOM_BROWSER_MATRIX_EXACT_FILES), true);
  assert.equal(isLiveClassroomBrowserMatrixScope([...LIVE_CLASSROOM_BROWSER_MATRIX_EXACT_FILES, 'netlify.toml']), false);
});

test('profile runs static contracts, installs Chromium, executes fixture matrix, and build gates', () => {
  assert.deepEqual(liveClassroomBrowserMatrixCommands.map((item) => item.label), [
    'install', 'focused-python-contracts', 'playwright-install-chromium', 'playwright-runtime-matrix',
    'typecheck', 'direct-vite-production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  assert.deepEqual(liveClassroomBrowserMatrixCommands.find((item) => item.label === 'playwright-install-chromium')?.args,
    ['playwright', 'install', 'chromium']);
  assert.deepEqual(liveClassroomBrowserMatrixCommands.find((item) => item.label === 'playwright-runtime-matrix')?.args,
    ['playwright', 'test', '--config=tests/trainingos-ui-e2e/live-classroom-runtime-matrix.config.ts']);
});

test('fixed counts distinguish static and browser evidence', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-browser-matrix-current-main-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_PYTHON_COUNT = 7;',
    'const EXPECTED_BROWSER_COUNT = 5;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'live-classroom-browser-matrix-current-main'",
  ]) assert.equal(source.includes(token), true, token);
});

test('profile has no RTC/provider/database/deployment execution command', () => {
  const text = JSON.stringify(liveClassroomBrowserMatrixCommands).toLowerCase();
  for (const forbidden of ['curl', 'wget', 'ssh', 'tencent', 'createroom', 'joinclass', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
