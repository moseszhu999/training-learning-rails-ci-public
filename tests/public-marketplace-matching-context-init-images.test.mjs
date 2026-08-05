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

test('wrapper pins the four Supabase CLI v2.101.0 database-init images', () => {
  for (const image of [
    'supabase/postgres:17.6.1.106',
    'supabase/gotrue:v2.188.1',
    'supabase/realtime:v2.86.3',
    'supabase/storage-api:v1.54.1',
  ]) assert.ok(wrapper.includes(image), image);

  for (const mirror of [
    'public.ecr.aws/supabase/postgres:17.6.1.106',
    'public.ecr.aws/supabase/gotrue:v2.188.1',
    'public.ecr.aws/supabase/realtime:v2.86.3',
    'public.ecr.aws/supabase/storage-api:v1.54.1',
  ]) assert.ok(wrapper.includes(mirror), mirror);
});

test('each image uses bounded retries, mirror retag, inspect and cleanup', () => {
  assert.match(wrapper, /for attempt in 1 2 3; do/);
  assert.match(wrapper, /docker pull "\$image"/);
  assert.match(wrapper, /docker tag "\$mirror" "\$primary"/);
  assert.match(wrapper, /docker image inspect "\$primary"/);
  assert.match(wrapper, /docker image rm "\$\{primary_images\[@\]\}" "\$\{mirror_images\[@\]\}"/);
  assert.match(wrapper, /trap cleanup_images EXIT/);
});

test('wrapper preserves the original sealed replay and publishes no logs', () => {
  assert.match(wrapper, /bash "\$runner_script"/);
  assert.match(wrapper, /MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=init-image-prefetch-/);
  assert.doesNotMatch(wrapper, /cat .*\.log/);
  assert.doesNotMatch(wrapper, /tail .*\.log/);
  assert.doesNotMatch(wrapper, /upload-artifact/);
  assert.doesNotMatch(wrapper, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
});
