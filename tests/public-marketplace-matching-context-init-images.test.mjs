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
  assert.match(wrapper, /readonly candidate_health_timeout="5m"/);
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

test('temporary runner synchronously patches health timeout after init', () => {
  assert.match(wrapper, /health_old = '''wait_for_health_timeout\(\)\{/);
  assert.match(wrapper, /health_new = f'''patch_health_timeout\(\)\{/);
  assert.match(wrapper, /health timeout sequencing contract changed/);
  assert.match(wrapper, /legacy health timeout waiter remains/);
  assert.ok(wrapper.includes('CURRENT_STAGE="${label}-health-timeout-config"'));
  assert.ok(wrapper.includes('python - "$config" "{candidate_health_timeout}"'));
  assert.ok(wrapper.includes('health_timeout = "{value}"'));
  assert.ok(wrapper.includes('grep -Eq \'^health_timeout = "{candidate_health_timeout}"$\''));

  const initIndex = wrapper.indexOf('sealed "${label}-init" supabase --workdir "$workdir" init --force');
  const patchIndex = wrapper.indexOf('patch_health_timeout "$workdir" "$label"');
  const clearIndex = wrapper.indexOf('rm -rf "$workdir/supabase/migrations"');
  assert.ok(initIndex >= 0);
  assert.ok(patchIndex > initIndex);
  assert.ok(clearIndex > patchIndex);
});

test('wrapper removes all asynchronous watcher and runner races', () => {
  for (const forbidden of [
    'patch_health_timeout_when_ready',
    'fresh_watcher_pid',
    'fresh_two_watcher_pid',
    'upgrade_watcher_pid',
    'runner_pid',
    'wait "$fresh_watcher_pid"',
    'wait "$upgrade_watcher_pid"',
    'bash "$runner_script" &',
  ]) assert.ok(!wrapper.includes(forbidden), forbidden);
  assert.match(wrapper, /prepare_debug_runner\nbash "\$runner_script"/);
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

test('wrapper preserves the original sealed replay and publishes no logs', () => {
  assert.match(wrapper, /bash "\$runner_script"/);
  assert.match(wrapper, /MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=init-image-prefetch-/);
  assert.doesNotMatch(wrapper, /cat .*\.log/);
  assert.doesNotMatch(wrapper, /tail .*\.log/);
  assert.doesNotMatch(wrapper, /upload-artifact/);
  assert.doesNotMatch(wrapper, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(wrapper, /echo .*start_log/);
});
