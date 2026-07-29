import { appendFile, mkdir, readFile, rm } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = (label, executable, args, kind = 'status', env = {}) => ({ label, executable, args, kind, env });
const legacyClassroomSuite = ['j', 'h', 'c'].join('');

const markdownContract = String.raw`
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),docs=path.join(root,'docs');
let count=0; function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.md')){const t=fs.readFileSync(p,'utf8');if(!/^#\s+\S/m.test(t)||/\u0000/.test(t))process.exit(2);count++;}}}
walk(docs); if(count===0)process.exit(3); console.log('MARKDOWN_CONTRACT status=PASS files='+count);
`;

export const profileCommands = Object.freeze({
  'student-learning-execution': [
    command('install', 'npm', ['ci']),
    command('learning-workspace', 'npm', ['run', 'validate:learning-workspace-bridge'], 'mixed'),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('vscode-bundle', 'node', ['extensions/trainingos-classroom-vscode/esbuild.mjs', '--production']),
    command('production-build', 'npm', ['run', 'build']),
  ],
  'scheduling-delivery': [
    command('install', 'npm', ['ci']),
    command('node-contract', 'node', ['--test', 'prototypes/trainingos-agent-mvp-v1/test/scheduling-delivery-runtime-v2.test.mjs'], 'node'),
    command('python-contract', 'python', ['-m', 'unittest', '-v', 'tests.test_trainingos_scheduling_delivery_runtime_v2_contract'], 'python'),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('production-build', 'npm', ['run', 'build']),
  ],
  'agent-recipe': [
    command('install', 'npm', ['ci']),
    command('syntax-compiler', 'node', ['--check', 'packages/training-recipe/src/compiler.mjs']),
    command('syntax-adapters', 'node', ['--check', 'packages/training-recipe/src/adapters.mjs']),
    command('syntax-runtime', 'node', ['--check', 'lib/trainingos-agent-gateway/recipe-runtime.mjs']),
    command('syntax-mcp', 'node', ['--check', 'lib/trainingos-agent-gateway/recipe-mcp-layer.mjs']),
    command('node-contract', 'node', ['--test', 'prototypes/trainingos-agent-mvp-v1/recipe-runtime.test.mjs'], 'node'),
    command('python-contract', 'python', ['-m', 'unittest', '-v', 'tests.test_trainingos_agent_recipe_contract'], 'python'),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('production-build', 'npm', ['run', 'build']),
  ],
  'classroom-explanation': [
    command('install', 'npm', ['ci']),
    command('syntax-runtime', 'node', ['--check', 'lib/trainingos-agent-gateway/classroom-explanation-runtime.mjs']),
    command('syntax-mcp', 'node', ['--check', 'lib/trainingos-agent-gateway/classroom-explanation-mcp-layer.mjs']),
    command('node-contract', 'node', ['--test', 'prototypes/trainingos-agent-mvp-v1/test/classroom-explanation-runtime.test.mjs'], 'node'),
    command('python-contract', 'python', ['-m', 'unittest', '-v', 'tests.test_trainingos_classroom_explanation_contract'], 'python'),
    command('intelligence-package', 'npm', ['--prefix', 'packages/training-classroom-intelligence', 'test']),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('production-build', 'npm', ['run', 'build']),
  ],
  'classroom-lark': [
    command('install', 'npm', ['ci']),
    command('syntax-provider', 'node', ['--check', 'packages/training-classroom-provider/src/provider-adapter.mjs']),
    command('syntax-lark', 'node', ['--check', 'packages/training-classroom-lark/src/lark-adapter.mjs']),
    command('syntax-gateway', 'node', ['--check', 'lib/trainingos-agent-gateway/classroom-lark-adapter.mjs']),
    command('syntax-runner', 'node', ['--check', 'scripts/run-trainingos-classroom-lark-adapter-validation.mjs']),
    command('node-contract', 'node', ['--test', 'prototypes/trainingos-agent-mvp-v1/classroom-lark-adapter.test.mjs'], 'node'),
    command('python-contract', 'python', ['tests/test_trainingos_classroom_lark_adapter_contract.py'], 'python'),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('production-build', 'npm', ['run', 'build']),
  ],
  'classroom-agent-queue': [
    command('install', 'npm', ['ci']),
    command('syntax-integration', 'node', ['--check', 'lib/trainingos-agent-gateway/classroom-agent-queue-integration.mjs']),
    command('syntax-persistent', 'node', ['--check', 'lib/trainingos-agent-gateway/persistent-teacher-agent.mjs']),
    command('syntax-queue', 'node', ['--check', 'lib/trainingos-agent-gateway/teacher-action-queue.mjs']),
    command('syntax-queue-mcp', 'node', ['--check', 'lib/trainingos-agent-gateway/mcp-teacher-action-queue-server.mjs']),
    command('syntax-persistent-mcp', 'node', ['--check', 'lib/trainingos-agent-gateway/mcp-persistent-teacher-agent-server.mjs']),
    command('node-contract', 'node', ['--test', 'prototypes/trainingos-agent-mvp-v1/classroom-agent-queue-integration.test.mjs'], 'node'),
    command('python-contract', 'python', ['tests/test_trainingos_classroom_agent_queue_integration_contract.py'], 'python'),
    command('queue-regression', 'node', ['--test', 'prototypes/trainingos-agent-mvp-v1/teacher-action-queue.test.mjs']),
    command('persistent-regression', 'node', ['--test', 'prototypes/trainingos-agent-mvp-v1/persistent-teacher-agent.test.mjs']),
    command('queue-python-regression', 'python', ['tests/test_trainingos_teacher_action_queue_contract.py']),
    command('persistent-python-regression', 'python', ['tests/test_trainingos_persistent_teacher_agent_contract.py']),
    command('draft-python-regression', 'python', ['tests/test_trainingos_persistent_teacher_agent_draft_execution_contract.py']),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('native-validation', 'node', ['scripts/run-trainingos-native-classroom-validation.mjs']),
    command('zero-permission-validation', 'node', ['scripts/run-trainingos-zero-permission-bridge-validation.mjs']),
    command('learning-workspace-validation', 'node', ['scripts/run-trainingos-learning-workspace-bridge-validation.mjs']),
    command('vscode-bundle', 'node', ['extensions/trainingos-classroom-vscode/esbuild.mjs', '--production']),
    command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  ],
  'challenge-runtime': [
    command('install', 'npm', ['ci']),
    command('syntax-package', 'node', ['--check', 'packages/training-challenge-proof/src/index.mjs']),
    command('syntax-gateway', 'node', ['--check', 'lib/trainingos-agent-gateway/challenge-proof-share.mjs']),
    command('node-contract', 'node', ['--test', 'prototypes/trainingos-agent-mvp-v1/test/challenge-proof-share-v1.test.mjs'], 'node'),
    command('python-contract', 'python', ['-m', 'unittest', '-v', 'tests.test_trainingos_challenge_proof_share_v1_contract'], 'python'),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('production-build', 'npm', ['run', 'build']),
    command('database-replay', 'bash', [path.join(publicRoot, 'scripts/run-challenge-runtime-database.sh')]),
  ],
  'challenge-web': [
    command('install', 'npm', ['ci']),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('production-build', 'npm', ['run', 'build']),
    command('playwright-browser', 'npx', ['playwright', 'install', '--with-deps', 'chromium']),
    command('playwright', 'npm', ['run', 'test:trainingos-ui:local']),
  ],
  'teacher-hub': [
    command('install', 'npm', ['ci']),
    command('hub-contract', 'python', ['-m', 'unittest', '-v', 'tests.test_trainingos_teacher_operations_hub_mount_contract'], 'python'),
    command('role-contracts', 'npm', ['run', `test:${legacyClassroomSuite}:membership`]),
    command('deep-links-stale-offline', 'npm', ['run', 'test:agent-ui']),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('production-build', 'npm', ['run', 'build']),
    command('playwright-browser', 'npx', ['playwright', 'install', '--with-deps', 'chromium']),
    command('playwright', 'npm', ['run', 'test:trainingos-ui:local']),
  ],
  'docs-launch': [
    command('markdown-contract', 'node', ['-e', markdownContract]),
  ],
  'generic-owned': [
    command('install', 'npm', ['ci']),
    command('owned-validation', 'npm', ['run', 'ci:owned'], 'status', {
      TRAININGOS_CI_INSTALL: 'always',
      TRAININGOS_CI_INCLUDE_PLAYWRIGHT: '0',
    }),
  ],
});

function parseNode(text) {
  const tests = [...text.matchAll(/^# tests\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
  const passed = [...text.matchAll(/^# pass\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
  const failed = [...text.matchAll(/^# fail\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
  return { tests, passed, failed };
}

function parsePython(text) {
  const tests = [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)].reduce((sum, match) => sum + Number(match[1]), 0);
  return { tests };
}

export async function runProfile({ profile, privateRepoPath, runnerTemp, expectedNodeCount, expectedPythonCount }) {
  const commands = profileCommands[profile];
  if (!commands) throw new Error('unsupported profile');
  await mkdir(runnerTemp, { recursive: true });

  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  let pythonTests = 0;
  let passedSteps = 0;

  try {
    for (let index = 0; index < commands.length; index += 1) {
      const item = commands[index];
      const logPath = path.join(runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: privateRepoPath,
        env: { ...process.env, ...item.env },
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const text = await readFile(logPath, 'utf8');
      if (item.kind === 'node' || item.kind === 'mixed') {
        const parsed = parseNode(text);
        nodeTests += parsed.tests;
        nodePassed += parsed.passed;
        nodeFailed += parsed.failed;
      }
      if (item.kind === 'python' || item.kind === 'mixed') pythonTests += parsePython(text).tests;
      if (result.status === 0) passedSteps += 1;
    }
  } finally {
    await rm(path.join(runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const expectedNode = Number(expectedNodeCount);
  const expectedPython = Number(expectedPythonCount);
  const commandsPassed = passedSteps === commands.length;
  const countsPassed = nodeTests === expectedNode && nodePassed === expectedNode && nodeFailed === 0 && pythonTests === expectedPython;
  return {
    ok: commandsPassed && countsPassed,
    stepCount: commands.length,
    passedStepCount: passedSteps,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
  };
}

async function main() {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const result = await runProfile({
    profile: process.env.VALIDATION_PROFILE,
    privateRepoPath: process.env.PRIVATE_REPO_PATH,
    runnerTemp: process.env.RUNNER_TEMP,
    expectedNodeCount: process.env.EXPECTED_NODE_COUNT,
    expectedPythonCount: process.env.EXPECTED_PYTHON_COUNT,
  });
  await appendFile(outputPath, [
    `status=${result.ok ? 'PASS' : 'FAIL'}`,
    `step_count=${result.stepCount}`,
    `passed_step_count=${result.passedStepCount}`,
    `node_tests=${result.nodeTests}`,
    `node_passed=${result.nodePassed}`,
    `python_tests=${result.pythonTests}`,
  ].join('\n') + '\n', 'utf8');
  console.log(`PROFILE_VALIDATION status=${result.ok ? 'PASS' : 'FAIL'} steps=${result.passedStepCount}/${result.stepCount} node=${result.nodePassed}/${result.nodeTests} python=${result.pythonTests}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`PROFILE_VALIDATION status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
