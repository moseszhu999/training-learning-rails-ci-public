import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const WORKSPACE_IA_DENSITY_EXACT_FILES = new Set([
  'apps/training-web/src/components/TrainingOsAdvancedManagementSurface.tsx',
  'apps/training-web/src/lib/trainingos-workspace-density.ts',
  'apps/training-web/src/trainingos-agent-native-remediation-v1.css',
  'docs/product/trainingos-workspace-ia-density-v1.md',
  'tests/test_trainingos_workspace_ia_density_v1.py',
]);

export const AGENT_WORKSPACE_BROWSER_MATRIX_EXACT_FILES = new Set([
  'docs/testing/trainingos-agent-workspace-playwright-matrix-v1.md',
  'playwright.config.ts',
  'tests/trainingos-ui-e2e/agent-native-workspace-fixture.spec.ts',
  'tests/trainingos-ui-e2e/agent-native-workspace-live.spec.ts',
  'tests/trainingos-ui-e2e/helpers/agent-native-workspace-live.ts',
]);

const command = (label, executable, args, kind = 'status', env = undefined) => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
  env: env ? Object.freeze(env) : undefined,
});

const IA_COMMANDS = Object.freeze([
  command('install', 'npm', ['ci']),
  command('python-contract', 'python', [
    '-m',
    'unittest',
    'tests.test_trainingos_workspace_ia_density_v1',
    '-v',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

const MATRIX_COMMANDS = Object.freeze([
  command('install', 'npm', ['ci']),
  command('chromium-install', 'npx', ['playwright', 'install', '--with-deps', 'chromium']),
  command('fixture-browser-matrix', 'npx', [
    'playwright',
    'test',
    'tests/trainingos-ui-e2e/agent-native-workspace-fixture.spec.ts',
    '--project=Desktop 1440',
    '--project=Tablet 1024',
    '--project=Mobile 390',
    '--reporter=line',
  ], 'browser', {
    TRAININGOS_AGENT_WORKSPACE_FIXTURE_ONLY: '1',
  }),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

function parsePython(text) {
  const match = String(text).match(/Ran\s+(\d+)\s+tests?/m);
  return match ? Number(match[1]) : 0;
}

function parseBrowserPassed(text) {
  const matches = [...String(text).matchAll(/(?:^|\s)(\d+)\s+passed(?:\s|$)/gm)];
  return matches.length ? Number(matches.at(-1)[1]) : 0;
}

function parseBrowserSkipped(text) {
  const matches = [...String(text).matchAll(/(?:^|\s)(\d+)\s+skipped(?:\s|$)/gm)];
  return matches.length ? Number(matches.at(-1)[1]) : 0;
}

export function classifyBrowserFailure(text) {
  const output = String(text);
  if (/Process from config\.webServer was not able to start|Timed out waiting.*webServer|ERR_CONNECTION_REFUSED|ECONNREFUSED/i.test(output)) {
    return 'web-server';
  }
  if (/404\b|net::ERR_ABORTED|Failed to load resource|Cannot GET \/src\//i.test(output)) {
    return 'fixture-route';
  }
  if (/browserType\.launch|Executable doesn't exist|Failed to launch browser|Target page, context or browser has been closed/i.test(output)) {
    return 'browser-launch';
  }
  if (/Transform failed|Cannot find module|Module not found|SyntaxError|ReferenceError|TypeError:/i.test(output)) {
    return 'compile-runtime';
  }
  if (/Error:\s*expect\(|Expected:|Received:|toBeVisible|toHaveCount|toHaveClass|toHaveText|Timeout.*locator/i.test(output)) {
    return 'assertion';
  }
  return 'unknown';
}

function git(repoPath, args) {
  const result = spawnSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
  });
  if (result.status !== 0) throw new Error('git failed');
  return result.stdout.trim();
}

async function changedFiles({ privateRepoPath, runnerTemp, privateExactSha }) {
  const scopeText = await readFile(path.join(runnerTemp, 'trainingos-scope-contract.env'), 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const raw = git(privateRepoPath, [
    'diff', '--name-only', scope.expected_base_sha, privateExactSha,
  ]);
  return {
    files: raw ? raw.split('\n').filter(Boolean) : [],
    scope,
  };
}

function isExactScope(files, expected) {
  return files.length === expected.size && files.every((file) => expected.has(file));
}

export function isWorkspaceIaDensityScope(files) {
  return isExactScope(files, WORKSPACE_IA_DENSITY_EXACT_FILES);
}

export function isAgentWorkspaceBrowserMatrixScope(files) {
  return isExactScope(files, AGENT_WORKSPACE_BROWSER_MATRIX_EXACT_FILES);
}

function selectSuite(files) {
  if (isWorkspaceIaDensityScope(files)) {
    return Object.freeze({
      name: 'workspace-ia-density',
      commands: IA_COMMANDS,
      expectedNodeCount: 0,
      expectedPythonCount: 5,
    });
  }
  if (isAgentWorkspaceBrowserMatrixScope(files)) {
    return Object.freeze({
      name: 'agent-workspace-browser-matrix',
      commands: MATRIX_COMMANDS,
      expectedNodeCount: 6,
      expectedPythonCount: 0,
    });
  }
  return null;
}

export async function maybeRunWorkspaceIaDensityProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await changedFiles(input);
  const suite = selectSuite(files);
  if (!suite) return null;

  const fixedInput = Number(input.expectedNodeCount) === suite.expectedNodeCount
    && Number(input.expectedPythonCount) === suite.expectedPythonCount
    && scope.expected_changed_file_count === '5'
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
  if (!fixedInput) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return {
      ok: false,
      status: 'FAIL:fixed-input-contract',
      failedLabels: Object.freeze(['fixed-input-contract']),
      stepCount: suite.commands.length,
      passedStepCount: 0,
      nodeTests: 0,
      nodePassed: 0,
      nodeFailed: 0,
      pythonTests: 0,
      selectedSuite: suite.name,
    };
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let pythonTests = 0;
  let browserPassed = 0;
  let browserSkipped = 0;
  let browserFailure = 'none';
  const failedLabels = [];

  try {
    for (const [index, item] of suite.commands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: { ...process.env, ...(item.env ?? {}) },
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (item.kind === 'browser') {
        browserPassed += parseBrowserPassed(output);
        browserSkipped += parseBrowserSkipped(output);
        if (result.status !== 0) browserFailure = classifyBrowserFailure(output);
      }
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = suite.name === 'agent-workspace-browser-matrix'
    ? browserPassed === 6 && browserSkipped === 0
    : pythonTests === 5;
  const ok = passedStepCount === suite.commands.length && countsPassed;
  let status = 'PASS';
  if (!ok) {
    const labels = failedLabels.length ? failedLabels.join(',') : 'count-contract';
    status = suite.name === 'agent-workspace-browser-matrix' && browserFailure !== 'none'
      ? `FAIL:${labels}@${browserFailure}`
      : `FAIL:${labels}`;
  }

  return {
    ok,
    status,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: suite.commands.length,
    passedStepCount,
    nodeTests: browserPassed + browserSkipped,
    nodePassed: browserPassed,
    nodeFailed: 0,
    pythonTests,
    selectedSuite: suite.name,
  };
}
