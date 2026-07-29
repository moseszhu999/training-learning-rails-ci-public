import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  sanitizeBuildSubstage,
  sanitizeTypeScriptDiagnostics,
} from './sanitize-challenge-web-diagnostics.mjs';

const command = (label, executable, args, kind = 'status') => ({ label, executable, args, kind });
const commands = [
  command('install', 'npm', ['ci']),
  command('python-contract', 'npm', ['run', 'test:challenge-web:contract'], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
  command('playwright-browser', 'npx', ['playwright', 'install', '--with-deps', 'chromium']),
  command('playwright', 'npm', ['run', 'test:challenge-web']),
];

function parsePython(text) {
  return [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)].reduce((sum, match) => sum + Number(match[1]), 0);
}

export async function runChallengeWebDiagnostics({ privateRepoPath, runnerTemp, expectedPythonCount }) {
  let passedSteps = 0;
  let pythonTests = 0;
  const failedLabels = [];
  let typecheckDiagnostics = 'NOT_APPLICABLE';
  let buildSubstage = 'NOT_APPLICABLE';

  for (const [index, item] of commands.entries()) {
    const logPath = path.join(runnerTemp, `trainingos-profile-${index + 1}.log`);
    const result = spawnSync(item.executable, item.args, {
      cwd: privateRepoPath,
      env: process.env,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      shell: false,
    });
    const text = `${result.stdout || ''}${result.stderr || ''}`;
    await appendFile(logPath, text, { encoding: 'utf8', mode: 0o600 });
    if (item.kind === 'python') pythonTests += parsePython(text);
    if (result.status === 0) passedSteps += 1;
    else {
      failedLabels.push(item.label);
      if (item.label === 'typecheck') typecheckDiagnostics = sanitizeTypeScriptDiagnostics(text);
      if (item.label === 'production-build') buildSubstage = sanitizeBuildSubstage(text);
    }
  }

  const countsPassed = pythonTests === Number(expectedPythonCount);
  const ok = passedSteps === commands.length && countsPassed;
  const labels = [...failedLabels, ...(countsPassed ? [] : ['focused-counts'])];
  return {
    status: ok ? 'PASS' : `FAIL:${labels.join(',') || 'unknown-stage'}`,
    stepCount: commands.length,
    passedStepCount: passedSteps,
    pythonTests,
    typecheckDiagnostics,
    buildSubstage,
  };
}

async function main() {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const result = await runChallengeWebDiagnostics({
    privateRepoPath: process.env.PRIVATE_REPO_PATH,
    runnerTemp: process.env.RUNNER_TEMP,
    expectedPythonCount: process.env.EXPECTED_PYTHON_COUNT,
  });
  await appendFile(outputPath, [
    `status=${result.status}`,
    `step_count=${result.stepCount}`,
    `passed_step_count=${result.passedStepCount}`,
    'node_tests=0',
    'node_passed=0',
    `python_tests=${result.pythonTests}`,
    `typecheck_diagnostics=${result.typecheckDiagnostics}`,
    `build_substage=${result.buildSubstage}`,
  ].join('\n') + '\n', 'utf8');
  console.log(`CHALLENGE_WEB_DIAGNOSTICS status=${result.status} typecheck=${result.typecheckDiagnostics} build=${result.buildSubstage}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`CHALLENGE_WEB_DIAGNOSTICS status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
