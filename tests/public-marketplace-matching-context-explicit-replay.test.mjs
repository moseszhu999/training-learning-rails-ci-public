import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runner = readFileSync(
  new URL('../scripts/run-marketplace-matching-context-database.sh', import.meta.url),
  'utf8',
);
const wrapper = readFileSync(
  new URL('../scripts/run-marketplace-matching-context-with-init-images.sh', import.meta.url),
  'utf8',
);

test('v14 uses three genuine isolated replay workdirs', () => {
  assert.match(runner, /matching-context-fresh"/);
  assert.match(runner, /matching-context-fresh-two"/);
  assert.match(runner, /matching-context-upgrade"/);
  assert.match(runner, /initialize_empty_workdir "\$fresh" fresh-one/);
  assert.match(runner, /initialize_empty_workdir "\$fresh_two" fresh-two/);
  assert.match(runner, /initialize_empty_workdir "\$upgrade" upgrade/);
});

test('every replay starts empty before migrations are copied and explicitly applied', () => {
  const freshStart = runner.indexOf('start_with_marker "$fresh" fresh-one-empty-start');
  const freshCopy = runner.indexOf('copy_migrations "$exact_bootstrap/migrations" "$fresh" fresh-one');
  const freshApply = runner.indexOf('apply_migrations "$fresh" fresh-one');
  const secondStart = runner.indexOf('start_with_marker "$fresh_two" fresh-two-empty-start');
  const secondCopy = runner.indexOf('copy_migrations "$exact_bootstrap/migrations" "$fresh_two" fresh-two');
  const secondApply = runner.indexOf('apply_migrations "$fresh_two" fresh-two');
  const upgradeStart = runner.indexOf('start_with_marker "$upgrade" upgrade-empty-start');
  const baseCopy = runner.indexOf('copy_migrations "$base_bootstrap/migrations" "$upgrade" baseline');
  const baseApply = runner.indexOf('apply_migrations "$upgrade" baseline');
  const forwardCopy = runner.indexOf('cp "$PRIVATE_REPO_PATH/supabase/migrations/$migration_name"');
  const forwardApply = runner.indexOf('apply_migrations "$upgrade" upgrade');

  for (const position of [
    freshStart, freshCopy, freshApply,
    secondStart, secondCopy, secondApply,
    upgradeStart, baseCopy, baseApply, forwardCopy, forwardApply,
  ]) assert.ok(position >= 0);

  assert.ok(freshStart < freshCopy && freshCopy < freshApply);
  assert.ok(secondStart < secondCopy && secondCopy < secondApply);
  assert.ok(upgradeStart < baseCopy && baseCopy < baseApply);
  assert.ok(baseApply < forwardCopy && forwardCopy < forwardApply);
  assert.doesNotMatch(runner, /db reset/);
});

test('canonical bootstrap manifests remain exact and outside live workdirs', () => {
  assert.match(runner, /exact_bootstrap=.*matching-context-exact-bootstrap/);
  assert.match(runner, /base_bootstrap=.*matching-context-base-bootstrap/);
  assert.match(runner, /exact_bootstrap\/trainingos-bootstrap-manifest\.json/);
  assert.match(runner, /base_bootstrap\/trainingos-bootstrap-manifest\.json/);
  assert.match(runner, /canonical_migration_count=367/);
  assert.match(runner, /base_migration_count=366/);
});

test('baseline, both fresh replays and upgraded state verify applied migration counts', () => {
  assert.match(runner, /assert_applied_migration_count "\$fresh" fresh-one "\$canonical_migration_count"/);
  assert.match(runner, /assert_applied_migration_count "\$fresh_two" fresh-two "\$canonical_migration_count"/);
  assert.match(runner, /assert_applied_migration_count "\$upgrade" baseline "\$base_migration_count"/);
  assert.match(runner, /assert_applied_migration_count "\$upgrade" upgrade "\$canonical_migration_count"/);
  assert.match(runner, /supabase_migrations\.schema_migrations/);
});

test('SQL E2E, ACL, rollback and zero-residue run on all completed projections', () => {
  assert.match(runner, /run_e2e "\$fresh" fresh-one/);
  assert.match(runner, /run_e2e "\$fresh_two" fresh-two/);
  assert.match(runner, /run_e2e "\$upgrade" upgrade/);
  assert.match(runner, /anon_execute=false/);
  assert.match(runner, /public_execute=false/);
  assert.match(runner, /fixtures=0/);
  assert.match(runner, /new_tables=0/);
});

test('wrapper patches all three isolated configs before the runner proceeds', () => {
  assert.match(wrapper, /fresh_two_config=.*matching-context-fresh-two\/supabase\/config\.toml/);
  assert.match(wrapper, /fresh_two_watcher_pid=""/);
  assert.match(wrapper, /patch_health_timeout_when_ready "\$fresh_two_config" fresh-two &/);
  assert.match(wrapper, /wait "\$fresh_two_watcher_pid"/);
  assert.match(wrapper, /fresh_two_watcher_status/);
});

test('public PASS marker declares explicit empty-start migration sequencing', () => {
  assert.ok(runner.includes('empty_start=PASS'));
  assert.ok(runner.includes('explicit_migration_up=PASS'));
  assert.ok(runner.includes('baseline_replay=PASS'));
  assert.ok(runner.includes('fresh_replay=PASS'));
  assert.ok(runner.includes('second_replay=PASS'));
  assert.ok(runner.includes('upgrade_replay=PASS'));
});
