import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const challengeToken = '(challenge|invite|growth|attribution|evaluation|proof|sharing|entitlement|offer|launch)';
const customerEntry = new RegExp(`^apps/training-web/src/components/${['J', 'h', 'c', 'TrainingAdvancedEntrySurface'].join('')}\\.tsx$`);
const privilegedKeyPattern = new RegExp(`${['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_')}\\s*[:=]\\s*[^\\s\u0060]+`);
const agentNativeToken = '(agent-native|golden-path|learning|challenge|composer|recipe|workbuddy|hint|evidence|review|attempt|submission|content-resolution)';
const clientSource = /^(apps\/training-web\/src|extensions\/trainingos-classroom-vscode\/src)\//;
const privilegedRoleToken = ['service', 'role'].join('_');
const privilegedEnvToken = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
const clientServiceRole = new RegExp(`\\b${privilegedRoleToken}\\b|${privilegedEnvToken}|VITE_[A-Z0-9_]*${privilegedRoleToken}`, 'i');
const clientDirectWrite = /\b(?:supabase|supabaseClient)\s*(?:\?\.)?\.\s*(?:rpc\s*\(|from\s*\([^)]*\)[\s\S]{0,500}?\.\s*(?:insert|update|upsert|delete)\s*\()/i;

export const TEACHER_HUB_ROLE_MENU_EXACT_FILES = Object.freeze([
  'apps/training-web/src/components/JhcTrainingAdvancedEntrySurface.tsx',
  'apps/training-web/src/components/TrainingOsAdvancedManagementSurface.tsx',
  'apps/training-web/src/lib/trainingos-role-menu-permissions.ts',
  'netlify.toml',
  'netlify/functions/trainingos-agent-executions.mjs',
  'netlify/functions/trainingos-mcp-preview-runtime.mjs',
  'netlify/functions/trainingos-mcp.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/netlify-agent-executions-preview-runtime.test.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/netlify-mcp-preview-runtime.test.mjs',
  'tests/test_trainingos_advanced_settings.py',
  'tests/test_trainingos_risk_intervention_ui_contract.py',
  'tests/test_trainingos_role_menu_content_permissions_v1.py',
  'tests/test_trainingos_teacher_operations_hub_acceptance_contract.py',
  'tests/test_trainingos_teacher_operations_hub_mount_contract.py',
  'tests/test_trainingos_zero_permission_bridge_core_contract.py',
]);

export function isTeacherHubRoleMenuExactFiles(files) {
  const names = [...files].sort();
  const expected = [...TEACHER_HUB_ROLE_MENU_EXACT_FILES].sort();
  return names.length === expected.length
    && names.every((name, index) => name === expected[index])
    && !names.some((name) => name.startsWith('supabase/migrations/'));
}

export const profileAllowlist = Object.freeze({
  'challenge-runtime': [
    new RegExp(`^packages/training-${challengeToken}`),
    new RegExp(`^lib/trainingos-agent-gateway/.*${challengeToken}`),
    /^api\/integrations\/agents\/mcp\.mjs$/,
    /^netlify\/functions\/trainingos-mcp\.mjs$/,
    /^scripts\/run-trainingos-invite-growth-concurrency-e2e\.sh$/,
    new RegExp(`^supabase/migrations/[0-9]{14}_.*${challengeToken}.*\\.sql$`),
    new RegExp(`^prototypes/trainingos-agent-mvp-v1/.*${challengeToken}.*\\.(mjs|js)$`),
    new RegExp(`^tests/(sql/)?[^/]*${challengeToken}[^/]*\\.(py|sql|mjs|js)$`),
    /^tests\/test_trainingos_assessment_resume_execution_contract\.py$/,
    /^tests\/test_trainingos_student_exercise_execution_contract\.py$/,
    new RegExp(`^docs/(architecture|verification|testing|product)/.*${challengeToken}.*\\.md$`),
  ],
  'challenge-web': [
    new RegExp(`^apps/training-web/src/.*${challengeToken}`, 'i'),
    /^apps\/training-web\/src\/(App|RootApp|main)\.tsx$/,
    customerEntry,
    new RegExp(`^tests/.*${challengeToken}.*\\.(ts|tsx|mjs|js|py)$`),
    new RegExp(`^docs/(architecture|verification|testing|product)/.*${challengeToken}.*\\.md$`),
    /^package\.json$/,
    /^playwright\.config\.ts$/,
  ],
  'teacher-hub': [
    /^apps\/training-web\/src\/.*(TeacherOperationsHub|teacher-operations-hub|teacher-hub)/,
    /^apps\/training-web\/src\/components\/(TrainingOsAdvancedManagementSurface)\.tsx$/,
    customerEntry,
    /^lib\/trainingos-agent-gateway\/.*teacher.*(hub|operations|adapter)/,
    /^tests\/.*teacher.*(hub|operations).*/,
    /^docs\/(architecture|verification|testing|product)\/.*teacher.*(hub|operations).*\.md$/,
  ],
  'agent-native-learning-product': [
    /^api\/integrations\/agents\/mcp\.mjs$/,
    /^netlify\/functions\/trainingos-mcp\.mjs$/,
    new RegExp(`^lib/trainingos-agent-gateway/.*${agentNativeToken}.*\\.(mjs|js|ts)$`, 'i'),
    /^apps\/training-web\/src\/.*\.(ts|tsx|css)$/,
    new RegExp(`^prototypes/trainingos-agent-mvp-v1/.*${agentNativeToken}.*\\.(mjs|js)$`, 'i'),
    /^tests\/test_trainingos_agent_native_learning_golden_path_contract\.py$/,
    /^tests\/trainingos-ui-e2e\/agent-native-learning-golden-path\.spec\.ts$/,
    /^tests\/sql\/trainingos_agent_native_learning_golden_path_(e2e|cleanup_e2e)\.sql$/,
    new RegExp(`^tests/.*${agentNativeToken}.*\\.(py|sql|mjs|js|ts|tsx)$`, 'i'),
    new RegExp(`^docs/(architecture|verification|testing|product)/.*${agentNativeToken}.*\\.md$`, 'i'),
    /^package\.json$/,
    /^playwright\.config\.ts$/,
  ],
  'docs-launch': [/^docs\//, /^README\.md$/],
});

export const SECRET_PATTERNS = [
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk|sk-proj|ghp|github_pat)_[A-Za-z0-9_-]{20,}/,
  privilegedKeyPattern,
  /postgres(?:ql)?:\/\/[^\s\u0060]+/i,
];

function git(repoPath, args) {
  const result = spawnSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
  });
  if (result.status !== 0) throw new Error('git command failed');
  return result.stdout.trim();
}

async function inspectChangedFiles(input, changedFiles, failures) {
  const allowlist = profileAllowlist[input.validationProfile];
  const exactTeacherHubRoleMenu = input.validationProfile === 'teacher-hub'
    && isTeacherHubRoleMenuExactFiles(changedFiles);
  if (
    !exactTeacherHubRoleMenu
    && allowlist
    && changedFiles.some((name) => !allowlist.some((rule) => rule.test(name)))
  ) {
    failures.push('profileAllowlist');
  }

  for (const name of changedFiles) {
    if (/\.(png|jpe?g|gif|webp|ico|pdf|zip)$/i.test(name)) continue;
    let text = '';
    try {
      text = await readFile(path.join(input.privateRepoPath, name), 'utf8');
    } catch {
      continue;
    }
    if (SECRET_PATTERNS.some((rule) => rule.test(text))) failures.push('secretOrCredential');
    const challengeProductionSource = name.startsWith('apps/training-web/src/');
    if (
      input.validationProfile === 'challenge-web'
      && challengeProductionSource
      && /@supabase\/supabase-js|createClient\s*\(|\bsupabase\s*\./.test(text)
    ) {
      failures.push('directSupabase');
    }
    if (
      input.validationProfile === 'agent-native-learning-product'
      && clientSource.test(name)
      && clientDirectWrite.test(text)
    ) {
      failures.push('directSupabaseWrite');
    }
    if (
      input.validationProfile === 'agent-native-learning-product'
      && clientSource.test(name)
      && clientServiceRole.test(text)
    ) {
      failures.push('clientServiceRole');
    }
    if (input.validationProfile === 'docs-launch' && /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.test(text)) {
      failures.push('piiEmail');
    }
  }
}

export async function verifyScope(input) {
  const failures = [];
  let actualSha = '';
  let actualMainSha = '';
  let mergeBase = '';
  let changedFiles = [];

  try {
    actualSha = git(input.privateRepoPath, ['rev-parse', 'HEAD']);
    mergeBase = git(input.privateRepoPath, ['merge-base', input.expectedBaseSha, input.privateExactSha]);
    const raw = git(input.privateRepoPath, ['diff', '--name-only', input.expectedBaseSha, input.privateExactSha]);
    changedFiles = raw ? raw.split('\n').filter(Boolean) : [];
    if (input.validationProfile === 'main-release') {
      actualMainSha = git(input.privateMainRepoPath, ['rev-parse', 'HEAD']);
    }
  } catch {
    failures.push('git');
  }

  if (actualSha !== input.privateExactSha) failures.push('exactSha');
  if (mergeBase !== input.expectedBaseSha) failures.push('mergeBase');
  if (changedFiles.length !== Number(input.expectedChangedFileCount)) failures.push('changedFileCount');

  if (input.validationProfile === 'main-release') {
    if (actualMainSha !== input.expectedMainSha) failures.push('mainRef');
    if (actualSha !== actualMainSha) failures.push('exactMainEquality');
    if (input.expectedBaseSha !== input.expectedMainSha) failures.push('mainBaseEquality');
  }

  const migrations = changedFiles
    .map((name) => name.match(/^supabase\/migrations\/([0-9]{14})_[^/]+\.sql$/))
    .filter(Boolean)
    .map((match) => match[1]);

  if (input.migrationStart === 'none' && migrations.length !== 0) failures.push('unexpectedMigration');
  if (input.migrationStart !== 'none') {
    if (migrations.length === 0) failures.push('missingMigration');
    if (migrations.some((stamp) => stamp < input.migrationStart || stamp > input.migrationEnd)) failures.push('migrationRange');
  }

  await inspectChangedFiles(input, changedFiles, failures);

  const uniqueFailures = [...new Set(failures)];
  return {
    ok: uniqueFailures.length === 0,
    failures: uniqueFailures,
    actualSha,
    actualMainSha,
    mergeBase,
    changedFileCount: changedFiles.length,
    migrationCount: migrations.length,
    mainRefEquality: input.validationProfile === 'main-release' && actualSha === actualMainSha ? 'PASS' : input.validationProfile === 'main-release' ? 'FAIL' : 'NOT_APPLICABLE',
  };
}

async function main() {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const input = {
    privateRepoPath: process.env.PRIVATE_REPO_PATH,
    privateMainRepoPath: process.env.PRIVATE_MAIN_REPO_PATH,
    privateExactSha: process.env.PRIVATE_EXACT_SHA,
    expectedBaseSha: process.env.EXPECTED_BASE_SHA,
    expectedMainSha: process.env.EXPECTED_MAIN_SHA,
    validationProfile: process.env.VALIDATION_PROFILE,
    expectedChangedFileCount: process.env.EXPECTED_CHANGED_FILE_COUNT,
    migrationStart: process.env.MIGRATION_START,
    migrationEnd: process.env.MIGRATION_END,
  };
  const result = await verifyScope(input);
  if (result.ok && process.env.RUNNER_TEMP) {
    const scopePath = path.join(process.env.RUNNER_TEMP, 'trainingos-scope-contract.env');
    await writeFile(scopePath, [
      `expected_base_sha=${input.expectedBaseSha}`,
      `expected_changed_file_count=${input.expectedChangedFileCount}`,
      `migration_start=${input.migrationStart}`,
      `migration_end=${input.migrationEnd}`,
      `validation_profile=${input.validationProfile}`,
    ].join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
  }
  await appendFile(outputPath, [
    `status=${result.ok ? 'PASS' : 'FAIL'}`,
    `actual_sha=${result.actualSha}`,
    `actual_main_sha=${result.actualMainSha}`,
    `main_ref_equality=${result.mainRefEquality}`,
    `merge_base=${result.mergeBase}`,
    `changed_file_count=${result.changedFileCount}`,
    `migration_count=${result.migrationCount}`,
    `failure_count=${result.failures.length}`,
  ].join('\n') + '\n', 'utf8');
  console.log(`SCOPE_VERIFICATION status=${result.ok ? 'PASS' : 'FAIL'} files=${result.changedFileCount} migrations=${result.migrationCount} main_ref=${result.mainRefEquality}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`SCOPE_VERIFICATION status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
