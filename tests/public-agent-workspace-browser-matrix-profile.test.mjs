import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AGENT_WORKSPACE_BROWSER_MATRIX_EXACT_FILES,
  WORKSPACE_IA_DENSITY_EXACT_FILES,
  classifyBrowserFailure,
  isAgentWorkspaceBrowserMatrixScope,
  isWorkspaceIaDensityScope,
} from '../scripts/run-workspace-ia-density-profile.mjs';

const profileText = readFileSync(new URL('../scripts/run-workspace-ia-density-profile.mjs', import.meta.url), 'utf8');

const browserFiles = [
  'docs/testing/trainingos-agent-workspace-playwright-matrix-v1.md',
  'playwright.config.ts',
  'tests/trainingos-ui-e2e/agent-native-workspace-fixture.spec.ts',
  'tests/trainingos-ui-e2e/agent-native-workspace-live.spec.ts',
  'tests/trainingos-ui-e2e/helpers/agent-native-workspace-live.ts',
];

const iaFiles = [
  'apps/training-web/src/components/TrainingOsAdvancedManagementSurface.tsx',
  'apps/training-web/src/lib/trainingos-workspace-density.ts',
  'apps/training-web/src/trainingos-agent-native-remediation-v1.css',
  'docs/product/trainingos-workspace-ia-density-v1.md',
  'tests/test_trainingos_workspace_ia_density_v1.py',
];

test('browser matrix owns exactly five Playwright test and documentation files', () => {
  assert.deepEqual([...AGENT_WORKSPACE_BROWSER_MATRIX_EXACT_FILES].sort(), [...browserFiles].sort());
  assert.equal(isAgentWorkspaceBrowserMatrixScope(browserFiles), true);
  assert.equal(isAgentWorkspaceBrowserMatrixScope(browserFiles.slice(1)), false);
  assert.equal(isAgentWorkspaceBrowserMatrixScope([...browserFiles, 'apps/training-web/x.tsx']), false);
});

test('existing workspace IA profile retains its original exact scope', () => {
  assert.deepEqual([...WORKSPACE_IA_DENSITY_EXACT_FILES].sort(), [...iaFiles].sort());
  assert.equal(isWorkspaceIaDensityScope(iaFiles), true);
  assert.equal(isWorkspaceIaDensityScope(browserFiles), false);
});

test('browser profile installs Chromium and runs only the fixture spec', () => {
  assert.match(profileText, /playwright', 'install', '--with-deps', 'chromium'/);
  assert.match(profileText, /agent-native-workspace-fixture\.spec\.ts/);
  assert.doesNotMatch(profileText, /playwright', 'test',[\s\S]*agent-native-workspace-live\.spec\.ts/);
});

test('browser matrix locks Desktop Tablet and Mobile projects', () => {
  for (const marker of [
    '--project=Desktop 1440',
    '--project=Tablet 1024',
    '--project=Mobile 390',
  ]) assert.ok(profileText.includes(marker), marker);
});

test('fixture-only environment is explicit and network live skips cannot count', () => {
  assert.match(profileText, /TRAININGOS_AGENT_WORKSPACE_FIXTURE_ONLY: '1'/);
  assert.match(profileText, /browserPassed === 6 && browserSkipped === 0/);
  assert.match(profileText, /expectedNodeCount: 6/);
  assert.match(profileText, /expectedPythonCount: 0/);
});

test('browser failures are classified without publishing raw Playwright logs', () => {
  assert.equal(classifyBrowserFailure('Process from config.webServer was not able to start'), 'web-server');
  assert.equal(classifyBrowserFailure('GET /src/example 404 Failed to load resource'), 'fixture-route');
  assert.equal(classifyBrowserFailure('browserType.launch: Executable does not exist'), 'browser-launch');
  assert.equal(classifyBrowserFailure('Transform failed: Cannot find module x'), 'compile-runtime');
  assert.equal(classifyBrowserFailure('Error: expect(locator).toBeVisible Expected: visible'), 'assertion');
  assert.equal(classifyBrowserFailure('unrecognized private runner output'), 'unknown');
  assert.match(profileText, /FAIL:\$\{labels\}@\$\{browserFailure\}/);
  assert.doesNotMatch(profileText, /console\.log\(output\)|process\.stdout\.write\(output\)/);
});

test('browser profile still runs typecheck production build and bundle verification', () => {
  for (const marker of [
    "command('typecheck', 'npm', ['run', 'typecheck'])",
    "command('production-build', 'npm', ['run', 'build'])",
    "command('bundle-verification', 'npm', ['run', 'verify:build'])",
  ]) assert.ok(profileText.includes(marker), marker);
});

test('profile contains no deployment database or product-write command', () => {
  assert.doesNotMatch(profileText, /netlify deploy|vercel deploy|--prod|supabase db|migration up/i);
  assert.doesNotMatch(profileText, /service.role|access.token|database.password/i);
});

test('fixed input requires five files and no migration range', () => {
  assert.match(profileText, /scope\.expected_changed_file_count === '5'/);
  assert.match(profileText, /scope\.migration_start === 'none'/);
  assert.match(profileText, /scope\.migration_end === 'none'/);
});
