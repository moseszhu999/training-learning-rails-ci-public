import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyCommandFailure, computeFinalVerdict } from './main-release-verdict.mjs';

const requestedFlagNames = [
  'RUN_FRESH_REPLAY',
  'RUN_UPGRADE_REPLAY',
  'RUN_APPLICATION_CONTRACTS',
  'RUN_TYPECHECK',
  'RUN_PRODUCTION_BUILD',
  'RUN_CRITICAL_E2E',
];

const nodeFiles = Object.freeze([
  'prototypes/trainingos-agent-mvp-v1/zero-permission-mcp-composition.test.mjs',
  'prototypes/trainingos-agent-mvp-v1/student-learning-canonical-reconciliation.test.mjs',
  'prototypes/trainingos-agent-mvp-v1/classroom-agent-queue-integration.test.mjs',
  'prototypes/trainingos-agent-mvp-v1/teacher-action-queue.test.mjs',
  'prototypes/trainingos-agent-mvp-v1/persistent-teacher-agent.test.mjs',
]);

const legacyClassroomSuite = ['j', 'h', 'c'].join('');

const pythonModules = Object.freeze([
  ['python-student-exercise', 'tests.test_trainingos_student_exercise_execution_contract'],
  ['python-assessment-resume', 'tests.test_trainingos_assessment_resume_execution_contract'],
  ['python-classroom-queue', 'tests.test_trainingos_classroom_agent_queue_integration_contract'],
  ['python-teacher-queue', 'tests.test_trainingos_teacher_action_queue_contract'],
  ['python-persistent-agent', 'tests.test_trainingos_persistent_teacher_agent_contract'],
]);

const buildCommands = Object.freeze([
  ['build-native-validation', 'node', ['scripts/run-trainingos-native-classroom-validation.mjs']],
  ['build-zero-permission', 'node', ['scripts/run-trainingos-zero-permission-bridge-validation.mjs']],
  ['build-learning-workspace', 'node', ['scripts/run-trainingos-learning-workspace-bridge-validation.mjs']],
  ['build-vscode-bundle', 'node', ['extensions/trainingos-classroom-vscode/esbuild.mjs', '--production']],
  ['build-vite-production', 'npx', ['vite', 'build', '--config', 'vite.config.ts']],
]);

function parseEnvFile(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

function countNode(text) {
  return [...text.matchAll(/^# tests\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
}

function countPython(text) {
  return [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)].reduce((sum, match) => sum + Number(match[1]), 0);
}

async function runFixed({ label, executable, args, cwd, runnerTemp, env = {}, baseline = true }) {
  const logPath = path.join(runnerTemp, `trainingos-main-release-${label}.log`);
  const descriptor = openSync(logPath, 'w', 0o600);
  const result = spawnSync(executable, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', descriptor, descriptor],
    shell: false,
  });
  closeSync(descriptor);
  const text = await readFile(logPath, 'utf8').catch(() => '');
  return {
    ok: result.status === 0,
    status: result.status,
    text,
    failureClass: result.status === 0 ? null : classifyCommandFailure(text, { baseline }),
  };
}

export async function runMainReleaseGate(input) {
  await mkdir(input.runnerTemp, { recursive: true });
  const stages = {
    freshDatabaseReplay: 'NOT_RUN',
    migrationSecondPassReplay: 'NOT_RUN',
    existingProjectUpgradeReplay: 'NOT_RUN',
    canonicalDatabaseContracts: 'NOT_RUN',
    focusedNodeContracts: 'NOT_RUN',
    focusedPythonContracts: 'NOT_RUN',
    applicationContracts: 'NOT_RUN',
    typecheck: 'NOT_RUN',
    productionBuild: 'NOT_RUN',
    criticalRolePermissionContracts: 'NOT_RUN',
    criticalTeacherStudentE2E: 'NOT_RUN',
    zeroResidueVerification: 'NOT_RUN',
  };
  const explicitFailureClasses = [];
  const failureLabels = [];
  let failureStage = 'NONE';
  let nodeTests = 0;
  let pythonTests = 0;
  let migration = {
    count: '0', fingerprint: 'NOT_RUN', first: 'NOT_RUN', last: 'NOT_RUN',
  };

  const recordFailure = (label, result, stage = label) => {
    failureLabels.push(label);
    explicitFailureClasses.push(result?.failureClass ?? 'BASELINE_FAILURE');
    if (failureStage === 'NONE') failureStage = stage;
  };

  const flags = Object.fromEntries(requestedFlagNames.map((name) => [name, input[name] === 'true']));
  const allRequested = Object.values(flags).every(Boolean);
  const needsNpm = flags.RUN_APPLICATION_CONTRACTS || flags.RUN_TYPECHECK || flags.RUN_PRODUCTION_BUILD || flags.RUN_CRITICAL_E2E;

  let staticDatabaseContractsOk = true;
  if (flags.RUN_FRESH_REPLAY) {
    const syntax = await runFixed({
      label: 'database-syntax',
      executable: 'python',
      args: ['-m', 'py_compile', 'scripts/build-trainingos-fresh-bootstrap.py', 'scripts/trainingos_database_replay_contract.py'],
      cwd: input.privateRepoPath,
      runnerTemp: input.runnerTemp,
    });
    const shellSyntax = await runFixed({
      label: 'database-shell-syntax',
      executable: 'bash',
      args: ['-n', 'scripts/run-trainingos-fresh-database-replay.sh'],
      cwd: input.privateRepoPath,
      runnerTemp: input.runnerTemp,
    });
    const unit = await runFixed({
      label: 'database-contracts',
      executable: 'python',
      args: ['-m', 'unittest', '-v', 'tests.test_trainingos_full_history_database_replay', 'tests.test_trainingos_full_history_migration_range'],
      cwd: input.privateRepoPath,
      runnerTemp: input.runnerTemp,
    });
    const bootstrapCode = `import importlib.util; from pathlib import Path; p=Path('tests/test_trainingos_fresh_database_bootstrap.py'); s=importlib.util.spec_from_file_location('main_release_bootstrap',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); t=sorted((k,v) for k,v in vars(m).items() if k.startswith('test_') and callable(v)); assert len(t)==6; [f() for _,f in t]`;
    const bootstrap = await runFixed({
      label: 'database-bootstrap-contracts',
      executable: 'python',
      args: ['-c', bootstrapCode],
      cwd: input.privateRepoPath,
      runnerTemp: input.runnerTemp,
    });
    staticDatabaseContractsOk = syntax.ok && shellSyntax.ok && unit.ok && bootstrap.ok;
    if (!staticDatabaseContractsOk) {
      stages.canonicalDatabaseContracts = 'FAIL';
      for (const [label, result] of [
        ['database-syntax', syntax],
        ['database-shell-syntax', shellSyntax],
        ['database-contracts', unit],
        ['database-bootstrap-contracts', bootstrap],
      ]) if (!result.ok) recordFailure(label, result, 'canonical-database-contracts');
    }
  }

  if (flags.RUN_FRESH_REPLAY || flags.RUN_UPGRADE_REPLAY || flags.RUN_CRITICAL_E2E) {
    const dbOutput = path.join(input.runnerTemp, 'trainingos-main-release-database.status');
    const db = await runFixed({
      label: 'database-controller',
      executable: 'bash',
      args: ['scripts/run-main-release-database.sh'],
      cwd: input.publicRepoPath,
      runnerTemp: input.runnerTemp,
      env: {
        PRIVATE_REPO_PATH: input.privateRepoPath,
        PRIVATE_EXACT_SHA: input.privateExactSha,
        EXPECTED_MIGRATION_COUNT: input.expectedMigrationCount,
        MAIN_RELEASE_DATABASE_OUTPUT: dbOutput,
        RUN_FRESH_REPLAY: String(flags.RUN_FRESH_REPLAY),
        RUN_UPGRADE_REPLAY: String(flags.RUN_UPGRADE_REPLAY),
        RUN_CRITICAL_E2E: String(flags.RUN_CRITICAL_E2E),
      },
    });
    const parsed = parseEnvFile(await readFile(dbOutput, 'utf8').catch(() => ''));
    stages.freshDatabaseReplay = parsed.fresh_replay ?? 'NOT_RUN';
    stages.migrationSecondPassReplay = parsed.second_pass ?? 'NOT_RUN';
    stages.existingProjectUpgradeReplay = parsed.upgrade_replay ?? 'NOT_RUN';
    const databaseControllerContracts = parsed.canonical_database_contracts ?? 'NOT_RUN';
    stages.canonicalDatabaseContracts = flags.RUN_FRESH_REPLAY
      ? (staticDatabaseContractsOk && databaseControllerContracts === 'PASS' ? 'PASS' : databaseControllerContracts === 'NOT_RUN' ? 'NOT_RUN' : 'FAIL')
      : databaseControllerContracts;
    stages.criticalRolePermissionContracts = parsed.role_permission_contracts ?? 'NOT_RUN';
    stages.criticalTeacherStudentE2E = parsed.teacher_student_e2e ?? 'NOT_RUN';
    stages.zeroResidueVerification = parsed.zero_residue ?? 'NOT_RUN';
    migration = {
      count: parsed.migration_count ?? '0',
      fingerprint: parsed.migration_fingerprint ?? 'NOT_RUN',
      first: parsed.first_migration ?? 'NOT_RUN',
      last: parsed.last_migration ?? 'NOT_RUN',
    };
    if (!db.ok) {
      const label = parsed.failure_stage && parsed.failure_stage !== 'NONE' ? parsed.failure_stage : 'database-controller';
      failureLabels.push(label);
      explicitFailureClasses.push(parsed.failure_class && parsed.failure_class !== 'NONE' ? parsed.failure_class : db.failureClass);
      if (failureStage === 'NONE') failureStage = label;
    }
  }

  let installOk = true;
  if (needsNpm) {
    const install = await runFixed({ label: 'npm-install', executable: 'npm', args: ['ci'], cwd: input.privateRepoPath, runnerTemp: input.runnerTemp });
    installOk = install.ok;
    if (!install.ok) recordFailure('npm-install', install);
  }

  if (flags.RUN_APPLICATION_CONTRACTS && installOk) {
    const focusedNode = await runFixed({ label: 'focused-node', executable: 'node', args: ['--test', ...nodeFiles], cwd: input.privateRepoPath, runnerTemp: input.runnerTemp });
    nodeTests = countNode(focusedNode.text);
    stages.focusedNodeContracts = focusedNode.ok && nodeTests > 0 ? 'PASS' : 'FAIL';
    if (stages.focusedNodeContracts === 'FAIL') recordFailure('focused-node-contracts', focusedNode, 'focused-node-contracts');

    let focusedPythonOk = true;
    for (const [label, moduleName] of pythonModules) {
      const result = await runFixed({ label, executable: 'python', args: ['-m', 'unittest', '-v', moduleName], cwd: input.privateRepoPath, runnerTemp: input.runnerTemp });
      pythonTests += countPython(result.text);
      focusedPythonOk &&= result.ok;
      if (!result.ok) recordFailure(label, result, 'focused-python-contracts');
    }
    stages.focusedPythonContracts = focusedPythonOk && pythonTests > 0 ? 'PASS' : 'FAIL';
    if (!focusedPythonOk && failureStage === 'NONE') failureStage = 'focused-python-contracts';

    const appCommands = [
      ['test-mvp', 'npm', ['run', 'test:mvp']],
      [`test-${legacyClassroomSuite}`, 'npm', ['run', `test:${legacyClassroomSuite}`]],
      [`test-${legacyClassroomSuite}-membership`, 'npm', ['run', `test:${legacyClassroomSuite}:membership`]],
      [`test-${legacyClassroomSuite}-backend-contract`, 'npm', ['run', `test:${legacyClassroomSuite}:supabase`]],
      ['test-agent', 'npm', ['run', 'test:agent']],
    ];
    let appOk = true;
    for (const [label, executable, args] of appCommands) {
      const result = await runFixed({ label, executable, args, cwd: input.privateRepoPath, runnerTemp: input.runnerTemp });
      appOk &&= result.ok;
      if (!result.ok) recordFailure(label, result, label);
    }
    stages.applicationContracts = appOk && stages.focusedNodeContracts === 'PASS' && stages.focusedPythonContracts === 'PASS' ? 'PASS' : 'FAIL';
  } else if (flags.RUN_APPLICATION_CONTRACTS) {
    stages.focusedNodeContracts = 'NOT_RUN';
    stages.focusedPythonContracts = 'NOT_RUN';
    stages.applicationContracts = 'NOT_RUN';
  }

  if (flags.RUN_TYPECHECK && installOk) {
    const result = await runFixed({ label: 'typecheck', executable: 'npm', args: ['run', 'typecheck'], cwd: input.privateRepoPath, runnerTemp: input.runnerTemp });
    stages.typecheck = result.ok ? 'PASS' : 'FAIL';
    if (!result.ok) recordFailure('typecheck', result);
  }

  if (flags.RUN_PRODUCTION_BUILD && installOk) {
    let buildOk = true;
    for (const [label, executable, args] of buildCommands) {
      const result = await runFixed({ label, executable, args, cwd: input.privateRepoPath, runnerTemp: input.runnerTemp });
      buildOk &&= result.ok;
      if (!result.ok) recordFailure(label, result, 'production-build');
    }
    stages.productionBuild = buildOk ? 'PASS' : 'FAIL';
  }

  if (flags.RUN_CRITICAL_E2E && installOk) {
    const zeroPermission = await runFixed({ label: 'zero-permission', executable: 'npm', args: ['run', 'validate:zero-permission-bridge'], cwd: input.privateRepoPath, runnerTemp: input.runnerTemp });
    if (!zeroPermission.ok) {
      stages.criticalRolePermissionContracts = 'FAIL';
      recordFailure('critical-role-permission-contracts', zeroPermission, 'critical-role-permission-contracts');
    } else if (stages.criticalRolePermissionContracts === 'PASS') {
      stages.criticalRolePermissionContracts = 'PASS';
    }
  }

  const verdict = computeFinalVerdict({ allRequested, stages, explicitFailureClasses });
  return {
    verdict,
    stages,
    explicitFailureClasses,
    failureStage,
    failureLabels: [...new Set(failureLabels)],
    nodeTests,
    pythonTests,
    migration,
  };
}

async function main() {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const result = await runMainReleaseGate({
    publicRepoPath: process.env.GITHUB_WORKSPACE,
    privateRepoPath: process.env.PRIVATE_REPO_PATH,
    privateExactSha: process.env.PRIVATE_EXACT_SHA,
    expectedMigrationCount: process.env.EXPECTED_MIGRATION_COUNT,
    runnerTemp: process.env.RUNNER_TEMP,
    RUN_FRESH_REPLAY: process.env.RUN_FRESH_REPLAY,
    RUN_UPGRADE_REPLAY: process.env.RUN_UPGRADE_REPLAY,
    RUN_APPLICATION_CONTRACTS: process.env.RUN_APPLICATION_CONTRACTS,
    RUN_TYPECHECK: process.env.RUN_TYPECHECK,
    RUN_PRODUCTION_BUILD: process.env.RUN_PRODUCTION_BUILD,
    RUN_CRITICAL_E2E: process.env.RUN_CRITICAL_E2E,
  });
  const lines = [
    `final_verdict=${result.verdict}`,
    `fresh_replay=${result.stages.freshDatabaseReplay}`,
    `second_pass=${result.stages.migrationSecondPassReplay}`,
    `upgrade_replay=${result.stages.existingProjectUpgradeReplay}`,
    `canonical_database_contracts=${result.stages.canonicalDatabaseContracts}`,
    `focused_node_contracts=${result.stages.focusedNodeContracts}`,
    `focused_python_contracts=${result.stages.focusedPythonContracts}`,
    `application_contracts=${result.stages.applicationContracts}`,
    `typecheck=${result.stages.typecheck}`,
    `production_build=${result.stages.productionBuild}`,
    `role_permission_contracts=${result.stages.criticalRolePermissionContracts}`,
    `teacher_student_e2e=${result.stages.criticalTeacherStudentE2E}`,
    `zero_residue=${result.stages.zeroResidueVerification}`,
    `node_tests=${result.nodeTests}`,
    `python_tests=${result.pythonTests}`,
    `migration_count=${result.migration.count}`,
    `migration_fingerprint=${result.migration.fingerprint}`,
    `first_migration=${result.migration.first}`,
    `last_migration=${result.migration.last}`,
    `failure_stage=${result.failureStage}`,
    `failure_labels=${result.failureLabels.length ? result.failureLabels.join(',') : 'NONE'}`,
  ];
  await appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`MAIN_RELEASE verdict=${result.verdict} failure_stage=${result.failureStage} failure_labels=${result.failureLabels.length ? result.failureLabels.join(',') : 'NONE'} migration_count=${result.migration.count}`);
  process.exitCode = result.verdict === 'PASS' ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`MAIN_RELEASE verdict=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
