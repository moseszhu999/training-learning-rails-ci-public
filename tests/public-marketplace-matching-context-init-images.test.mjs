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

test('matching-context profile invokes the bounded wrapper', () => {
  assert.match(profile, /run-marketplace-matching-context-with-init-images\.sh/);
  assert.doesNotMatch(
    profile,
    /command\('database-replay'[\s\S]*run-marketplace-matching-context-database\.sh/,
  );
});

test('wrapper pins the proven stable Supabase stack', () => {
  assert.match(wrapper, /readonly candidate_cli_version="2\.109\.1"/);
  assert.match(wrapper, /readonly candidate_health_timeout="5m"/);
  for (const image of [
    'supabase/postgres:17.6.1.143',
    'supabase/gotrue:v2.192.0',
    'supabase/realtime:v2.112.6',
    'supabase/storage-api:v1.62.5',
  ]) assert.ok(wrapper.includes(image), image);
});

test('each image uses bounded retries, mirror fallback, inspect and cleanup', () => {
  assert.match(wrapper, /for attempt in 1 2 3; do/);
  assert.match(wrapper, /docker pull "\$image"/);
  assert.match(wrapper, /docker tag "\$mirror" "\$primary"/);
  assert.match(wrapper, /docker image inspect "\$primary"/);
  assert.match(wrapper, /docker image rm "\$\{primary_images\[@\]\}" "\$\{mirror_images\[@\]\}"/);
  assert.match(wrapper, /trap cleanup_wrapper EXIT/);
});

test('temporary runner removes debug start and uses short isolated project paths', () => {
  assert.match(wrapper, /readonly runner_script="\$RUNNER_TEMP\/mc-v16-runner\.sh"/);
  assert.ok(wrapper.includes('fresh="$RUNNER_TEMP/mc-f1"'));
  assert.ok(wrapper.includes('fresh_two="$RUNNER_TEMP/mc-f2"'));
  assert.ok(wrapper.includes('upgrade="$RUNNER_TEMP/mc-up"'));
  assert.match(wrapper, /debug start must not be present/);
  assert.ok(!wrapper.includes("start_new = '  supabase --debug"));
});

test('each workdir is initialized immediately before its own empty start', () => {
  assert.ok(wrapper.includes('CURRENT_STAGE="fresh-one-initialization"'));
  assert.ok(wrapper.includes('CURRENT_STAGE="fresh-two-initialization"'));
  assert.ok(wrapper.includes('CURRENT_STAGE="upgrade-initialization"'));
  assert.match(wrapper, /initialization sequence contract changed/);
  assert.match(wrapper, /fresh-two sequencing contract changed/);
  assert.match(wrapper, /upgrade sequencing contract changed/);
  assert.ok(wrapper.includes("'CURRENT_STAGE=\"workdir-initialization\"'"));
});

test('health timeout is patched synchronously after init and before migration clearing', () => {
  assert.match(wrapper, /health_old = '''wait_for_health_timeout\(\)\{/);
  assert.match(wrapper, /health_new = f'''patch_health_timeout\(\)\{/);
  assert.match(wrapper, /health timeout sequencing contract changed/);
  assert.match(wrapper, /legacy health timeout waiter remains/);
  assert.ok(wrapper.includes('CURRENT_STAGE="${label}-health-timeout-config"'));
  assert.ok(wrapper.includes('health_timeout = "{value}"'));

  const initIndex = wrapper.indexOf('sealed "${label}-init" supabase --workdir "$workdir" init --force');
  const patchIndex = wrapper.indexOf('patch_health_timeout "$workdir" "$label"');
  const clearIndex = wrapper.indexOf('rm -rf "$workdir/supabase/migrations"');
  assert.ok(initIndex >= 0);
  assert.ok(patchIndex > initIndex);
  assert.ok(clearIndex > patchIndex);
});

test('wrapper remains synchronous and has no watcher race', () => {
  for (const forbidden of [
    'patch_health_timeout_when_ready',
    'fresh_watcher_pid',
    'fresh_two_watcher_pid',
    'upgrade_watcher_pid',
    'runner_pid',
    'bash "$runner_script" &',
  ]) assert.ok(!wrapper.includes(forbidden), forbidden);
  assert.match(wrapper, /prepare_runner\nbash "\$runner_script"/);
});

test('bounded classifier and sealed evidence remain intact', () => {
  for (const resource of [
    'port', 'image', 'dbhealth', 'dbconnect', 'migrationservice',
    'container', 'permission', 'disk', 'network', 'config', 'none',
  ]) assert.ok(wrapper.includes(`resource="${resource}"`), resource);
  for (const service of ['auth', 'realtime', 'storage', 'postgres', 'none']) {
    assert.ok(wrapper.includes(`service="${service}"`), service);
  }
  assert.ok(wrapper.includes('resource%s-service%s-exit%s'));
  assert.doesNotMatch(wrapper, /cat .*\.log/);
  assert.doesNotMatch(wrapper, /tail .*\.log/);
  assert.doesNotMatch(wrapper, /upload-artifact/);
  assert.doesNotMatch(wrapper, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
});
