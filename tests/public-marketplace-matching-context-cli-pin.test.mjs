import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const database = readFileSync(
  new URL('../scripts/run-marketplace-matching-context-database.sh', import.meta.url),
  'utf8',
);

test('matching context database replay installs the fixed official Supabase release binary', () => {
  assert.match(database, /supabase_cli_version="2\.101\.0"/);
  assert.match(database, /github\.com\/supabase\/cli\/releases\/download\/v\$\{supabase_cli_version\}\/supabase_linux_amd64\.tar\.gz/);
  assert.match(database, /curl --proto '=https' --tlsv1\.2 --fail --silent --show-error --location --retry 3/);
  assert.match(database, /tar -xzf "\$archive" -C "\$bin_dir"/);
  assert.match(database, /actual_supabase_version="\$\(supabase --version/);
  assert.match(database, /\[\[ "\$actual_supabase_version" == "\$supabase_cli_version" \]\]/);
  assert.doesNotMatch(database, /supabase@latest/);
  assert.doesNotMatch(database, /npx --yes supabase@/);
});

test('Supabase 2.101 init uses force without unsupported yes flag', () => {
  const compatibleInit = database.match(/supabase --workdir "\$(?:fresh|upgrade)" init --force/g) ?? [];
  assert.equal(compatibleInit.length, 2);
  assert.doesNotMatch(database, /init --force --yes/);
});

test('release binary install keeps download output sealed and cleans temporary files', () => {
  assert.match(database, /supabase-download\.log/);
  assert.match(database, /supabase-extract\.log/);
  assert.match(database, /rm -f "\$archive"/);
  assert.match(database, /rm -rf "\$fresh" "\$upgrade" "\$base_repo" "\$bin_dir"/);
  assert.doesNotMatch(database, /cat .*supabase-(?:download|extract)\.log/);
});

test('CLI installation does not weaken exact base, replay, E2E, ACL or cleanup gates', () => {
  for (const marker of [
    'start_with_marker "$upgrade" baseline-start',
    'start_with_marker "$fresh" fresh-start',
    'run_e2e "$fresh" fresh-one',
    'run_e2e "$fresh" fresh-two',
    'run_e2e "$upgrade" upgrade',
    'TRAININGOS_MARKETPLACE_MATCHING_CONTEXT_PROJECTION_V1_E2E_PASS',
    "grep -qx 'authenticated_execute=true'",
    "grep -qx 'anon_execute=false'",
    "grep -qx 'public_execute=false'",
    'zero_residue=PASS',
    'cleanup=PASS',
  ]) assert.ok(database.includes(marker), marker);
});
