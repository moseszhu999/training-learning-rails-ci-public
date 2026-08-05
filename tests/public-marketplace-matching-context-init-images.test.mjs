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

test('each image uses bounded retries, mirror retag, inspect and cleanup', () => {
  assert.match(wrapper, /for attempt in 1 2 3; do/);
  assert.match(wrapper, /docker pull "\$image"/);
  assert.match(wrapper, /docker tag "\$mirror" "\$primary"/);
  assert.match(wrapper, /docker image inspect "\$primary"/);
  assert.match(wrapper, /docker image rm "\$\{primary_images\[@\]\}" "\$\{mirror_images\[@\]\}"/);
  assert.match(wrapper, /trap cleanup_wrapper EXIT/);
});

test('wrapper patches both generated Supabase configs to a five-minute health timeout', () => {
  assert.match(wrapper, /readonly health_timeout="5m"/);
  assert.match(wrapper, /trainingos-marketplace-matching-context-fresh\/supabase\/config\.toml/);
  assert.match(wrapper, /trainingos-marketplace-matching-context-upgrade\/supabase\/config\.toml/);
  assert.match(wrapper, /patch_health_timeout_when_ready/);
  assert.ok(wrapper.includes('health_timeout = "{health_timeout}"'));
  assert.match(wrapper, /grep -Eq '\^health_timeout = "5m"\$'/);
  assert.match(wrapper, /MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=health-timeout-config/);
});

test('wrapper creates a temporary stable-stack debug runner without modifying the source runner', () => {
  assert.match(wrapper, /readonly source_runner=/);
  assert.match(wrapper, /readonly runner_script="\$RUNNER_TEMP\/trainingos-marketplace-matching-context-debug-runner\.sh"/);
  assert.match(wrapper, /prepare_debug_runner/);
  assert.match(wrapper, /stable stack replacement contract changed/);
  assert.match(wrapper, /legacy stack marker remains in candidate runner/);
  assert.ok(wrapper.includes('supabase_cli_version="2.109.1"'));
  assert.ok(wrapper.includes('supabase --debug --workdir "$workdir" db start'));
  assert.match(wrapper, /text\.count\(start_old\) != 1/);
  assert.match(wrapper, /target\.write_text\(text, encoding='utf-8'\)/);
  assert.match(wrapper, /chmod 700 "\$runner_script"/);
  assert.match(wrapper, /rm -f "\$runner_script"/);
});

test('sealed debug classifier emits bounded resource and service families', () => {
  for (const resource of [
    'port', 'image', 'dbhealth', 'dbconnect', 'migrationservice',
    'container', 'permission', 'disk', 'network', 'config', 'none',
  ]) assert.ok(wrapper.includes(`resource="${resource}"`), resource);

  for (const service of ['auth', 'realtime', 'storage', 'postgres', 'none']) {
    assert.ok(wrapper.includes(`service="${service}"`), service);
  }
  assert.ok(wrapper.includes('resource%s-service%s-exit%s'));
  assert.match(wrapper, /failure marker format contract changed/);
  assert.match(wrapper, /resource classifier contract changed/);
});

test('health-timeout watchers run before waiting for the sealed replay', () => {
  const runnerIndex = wrapper.indexOf('bash "$runner_script" &');
  const freshWatcherIndex = wrapper.indexOf('patch_health_timeout_when_ready "$fresh_config" fresh &');
  const upgradeWatcherIndex = wrapper.indexOf('patch_health_timeout_when_ready "$upgrade_config" upgrade &');
  const runnerWaitIndex = wrapper.indexOf('wait "$runner_pid"');
  assert.ok(runnerIndex >= 0);
  assert.ok(freshWatcherIndex > runnerIndex);
  assert.ok(upgradeWatcherIndex > freshWatcherIndex);
  assert.ok(runnerWaitIndex > upgradeWatcherIndex);
});

test('wrapper preserves the original sealed replay and publishes no logs', () => {
  assert.match(wrapper, /bash "\$runner_script"/);
  assert.match(wrapper, /MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=init-image-prefetch-/);
  assert.doesNotMatch(wrapper, /cat .*\.log/);
  assert.doesNotMatch(wrapper, /tail .*\.log/);
  assert.doesNotMatch(wrapper, /upload-artifact/);
  assert.doesNotMatch(wrapper, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(wrapper, /echo .*start_log/);
});
