import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_CLASSROOM_TENCENT_SERVER_AUTH_EXACT_FILES,
  isLiveClassroomTencentServerAuthorizationScope,
  liveClassroomTencentServerAuthorizationCommands,
} from '../scripts/run-live-classroom-tencent-server-authorization-profile.mjs';

test('Tencent Live Classroom server authorization selector is exactly six owned files', () => {
  assert.equal(LIVE_CLASSROOM_TENCENT_SERVER_AUTH_EXACT_FILES.size, 6);
  assert.equal(
    isLiveClassroomTencentServerAuthorizationScope(LIVE_CLASSROOM_TENCENT_SERVER_AUTH_EXACT_FILES),
    true,
  );
  assert.equal(
    isLiveClassroomTencentServerAuthorizationScope([
      ...LIVE_CLASSROOM_TENCENT_SERVER_AUTH_EXACT_FILES,
      'netlify.toml',
    ]),
    false,
  );
  const replaced = [...LIVE_CLASSROOM_TENCENT_SERVER_AUTH_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260807220000_not_allowed.sql';
  assert.equal(isLiveClassroomTencentServerAuthorizationScope(replaced), false);
});

test('fixed F2 profile runs syntax, 14 Node, 11 Python and real build gates', () => {
  assert.deepEqual(liveClassroomTencentServerAuthorizationCommands.map((item) => item.label), [
    'install',
    'api-syntax',
    'authorization-syntax',
    'endpoint-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const node = liveClassroomTencentServerAuthorizationCommands.find((item) => item.label === 'focused-node-contracts');
  assert.deepEqual(node?.args, [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-server-authorization.test.mjs',
  ]);
  assert.equal(node?.kind, 'node');
  const python = liveClassroomTencentServerAuthorizationCommands.find((item) => item.label === 'focused-python-contracts');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_tencent_server_authorization_v1',
  ]);
  assert.equal(python?.kind, 'python');
});

test('syntax commands are status-only and do not inflate Node test counts', () => {
  for (const label of ['api-syntax', 'authorization-syntax', 'endpoint-syntax']) {
    const command = liveClassroomTencentServerAuthorizationCommands.find((item) => item.label === label);
    assert.ok(command);
    assert.equal(command.kind, 'status');
    assert.equal(command.executable, 'node');
    assert.equal(command.args[0], '--check');
  }
});

test('F2 public profile performs no network, provider execution, database or deployment', () => {
  const text = JSON.stringify(liveClassroomTencentServerAuthorizationCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp',
    'deploy', 'netlify', 'vercel',
    'supabase db', 'psql',
    'lcic.tencentcloudapi.com', 'registeruser', 'loginoriginidwithroom', 'createroom',
    'playwright', 'bash -c', 'sh -c',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});

test('F2 build gate bypasses inherited npm prebuild but preserves actual bundle production path', () => {
  const text = JSON.stringify(liveClassroomTencentServerAuthorizationCommands);
  assert.equal(text.includes('npm","args":["run","build"'), false);
  assert.equal(text.includes('"vite","build","--config","vite.config.ts"'), true);
  assert.equal(text.includes('copy-trainingos-marketplace-web.mjs'), true);
  assert.equal(text.includes('verify:build'), true);
});
