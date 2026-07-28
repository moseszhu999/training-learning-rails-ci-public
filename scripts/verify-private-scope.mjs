import { appendFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function git(repoPath, args) {
  const result = spawnSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error('git command failed');
  return result.stdout.trim();
}

export function verifyScope(input) {
  const failures = [];
  let actualSha = '';
  let mergeBase = '';
  let changedFiles = [];

  try {
    actualSha = git(input.privateRepoPath, ['rev-parse', 'HEAD']);
    mergeBase = git(input.privateRepoPath, ['merge-base', input.expectedBaseSha, input.privateExactSha]);
    const raw = git(input.privateRepoPath, ['diff', '--name-only', input.expectedBaseSha, input.privateExactSha]);
    changedFiles = raw ? raw.split('\n').filter(Boolean) : [];
  } catch {
    failures.push('git');
  }

  if (actualSha !== input.privateExactSha) failures.push('exactSha');
  if (mergeBase !== input.expectedBaseSha) failures.push('mergeBase');
  if (changedFiles.length !== Number(input.expectedChangedFileCount)) failures.push('changedFileCount');

  const migrations = changedFiles
    .map((name) => name.match(/^supabase\/migrations\/([0-9]{14})_[^/]+\.sql$/))
    .filter(Boolean)
    .map((match) => match[1]);

  if (input.migrationStart === 'none' && migrations.length !== 0) failures.push('unexpectedMigration');
  if (input.migrationStart !== 'none') {
    if (migrations.length === 0) failures.push('missingMigration');
    if (migrations.some((stamp) => stamp < input.migrationStart || stamp > input.migrationEnd)) failures.push('migrationRange');
  }

  return {
    ok: failures.length === 0,
    failures,
    actualSha,
    mergeBase,
    changedFileCount: changedFiles.length,
    migrationCount: migrations.length,
  };
}

async function main() {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const result = verifyScope({
    privateRepoPath: process.env.PRIVATE_REPO_PATH,
    privateExactSha: process.env.PRIVATE_EXACT_SHA,
    expectedBaseSha: process.env.EXPECTED_BASE_SHA,
    expectedChangedFileCount: process.env.EXPECTED_CHANGED_FILE_COUNT,
    migrationStart: process.env.MIGRATION_START,
    migrationEnd: process.env.MIGRATION_END,
  });
  await appendFile(outputPath, [
    `status=${result.ok ? 'PASS' : 'FAIL'}`,
    `actual_sha=${result.actualSha}`,
    `merge_base=${result.mergeBase}`,
    `changed_file_count=${result.changedFileCount}`,
    `migration_count=${result.migrationCount}`,
    `failure_count=${result.failures.length}`,
  ].join('\n') + '\n', 'utf8');
  console.log(`SCOPE_VERIFICATION status=${result.ok ? 'PASS' : 'FAIL'} files=${result.changedFileCount} migrations=${result.migrationCount}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`SCOPE_VERIFICATION status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
