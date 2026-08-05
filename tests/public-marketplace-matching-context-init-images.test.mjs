import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wrapper = readFileSync(
  new URL('../scripts/run-marketplace-matching-context-with-init-images.sh', import.meta.url),
  'utf8',
);
const profile = readFileSync(
  new URL('../scripts/run-marketplace-matching-context-profile.mjs', import.meta.url),
  'utf8',
);

test('matching-context profile invokes the fixed init-image wrapper', () => {
  assert.match(profile, /run-marketplace-matching-context-with-init-images\.sh/);
  assert.doesNotMatch(
    profile,
    /command\('database-replay'[\s\S]*run-marketplace-matching-context-database\.sh/,
  );
});

test('wrapper pins the stable Supabase CLI 2.109.1 database-init stack', () => {
  assert.match(wrapper, /readonly candidate_cli_version="2\.109\.1"/);
  for (const image of [
    'supabase/postgres:17.6.1.143',
    'supabase/gotrue:v2.192.0',
    'supabase/realtime:v2.112.6',
    'supabase/storage-api:v1.62.5',
  ]) assert.ok(wrapper.includes(image), image);

  for (const mirror of [
    'public.ecr.aws/supabase/postgres:17.6.1.143',
    'public.ecr.aws/supabase/gotrue:v2.192.0',
    'public.ecr.aws/supabase/realtime:v2.112.6',
    'public.ecr.aws/supabase/storage-api:v1.62.5',
  ]) assert.ok(wrapper.includes(mirror), mirror);
});

test('candidate runner transformation is exact, temporary and fail closed', () => {
  assert.match(wrapper, /readonly source_runner_script=/);
  assert.match(wrapper, /readonly candidate_runner_script="\$RUNNER_TEMP\/run-marketplace-matching-context-database-v11\.sh"/);
  assert.match(wrapper, /prepare_candidate_runner/);
  assert.match(wrapper, /if text\.count\(old\) != 1:/);
  assert.match(wrapper, /legacy stack marker remains/);
  assert.match(wrapper, /chmod 700 "\$candidate_runner_script"/);
  assert.match(wrapper, /rm -f "\$candidate_runner_script"/);
  assert.match(wrapper, /bash "\$candidate_runner_script" &/);
  assert.doesNotMatch(wrapper, /bash "\$source_runner_script" &/);
});

test('each stable image uses bounded retries, mirror retag, inspect and cleanup', () => {
  assert.match(wrapper, /for attempt in 1 2 3; do/);
  assert.match(wrapper, /docker pull "\$image"/);
  assert.match(wrapper, /docker tag "\$mirror" "\$primary"/);
  assert.match(wrapper, /docker image inspect "\$primary"/);
  assert.match(wrapper, /docker image rm "\$\{primary_images\[@\]\}" "\$\{mirror_images\[@\]\}"/);
  assert.match(wrapper, /trap cleanup_wrapper EXIT/);
});

test('wrapper preserves five-minute health timeout for both isolated configs', () => {
  assert.match(wrapper, /readonly health_timeout="5m"/);
  assert.match(wrapper, /trainingos-marketplace-matching-context-fresh\/supabase\/config\.toml/);
  assert.match(wrapper, /trainingos-marketplace-matching-context-upgrade\/supabase\/config\.toml/);
  assert.match(wrapper, /patch_health_timeout_when_ready/);
  assert.ok(wrapper.includes('health_timeout = "{health_timeout}"'));
  assert.match(wrapper, /grep -Eq '\^health_timeout = "5m"\$'/);
  assert.match(wrapper, /MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=health-timeout-config/);
});

test('health-timeout watchers run before waiting for the sealed candidate replay', () => {
  const runnerIndex = wrapper.indexOf('bash "$candidate_runner_script" &');
  const freshWatcherIndex = wrapper.indexOf('patch_health_timeout_when_ready "$fresh_config" fresh &');
  const upgradeWatcherIndex = wrapper.indexOf('patch_health_timeout_when_ready "$upgrade_config" upgrade &');
  const runnerWaitIndex = wrapper.indexOf('wait "$runner_pid"');
  assert.ok(runnerIndex >= 0);
  assert.ok(freshWatcherIndex > runnerIndex);
  assert.ok(upgradeWatcherIndex > freshWatcherIndex);
  assert.ok(runnerWaitIndex > upgradeWatcherIndex);
});

test('wrapper preserves the original sealed replay contract and publishes no logs', () => {
  assert.match(wrapper, /run-marketplace-matching-context-database\.sh/);
  assert.match(wrapper, /MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=init-image-prefetch-/);
  assert.doesNotMatch(wrapper, /cat .*\.log/);
  assert.doesNotMatch(wrapper, /tail .*\.log/);
  assert.doesNotMatch(wrapper, /upload-artifact/);
  assert.doesNotMatch(wrapper, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
});
