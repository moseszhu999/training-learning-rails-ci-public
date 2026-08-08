import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COURSE_DESIGN_MCP_READ_V1_EXACT_FILES,
  courseDesignMcpReadV1Commands,
  isCourseDesignMcpReadV1Scope,
} from '../scripts/run-course-design-mcp-read-v1-profile.mjs';

const expectedFiles = new Set([
  'docs/architecture/trainingos-course-design-mcp-read-v1.md',
  'lib/trainingos-agent-gateway/course-design-context.mjs',
  'lib/trainingos-agent-gateway/mcp-chat-exercise-server.mjs',
  'tests/test_trainingos_course_design_mcp_read_v1.py',
  'tests/trainingos-agent-gateway/course-design-mcp-read-v1.test.mjs',
]);

test('selector accepts only the exact five private Course Design MCP files', () => {
  assert.deepEqual([...COURSE_DESIGN_MCP_READ_V1_EXACT_FILES].sort(), [...expectedFiles].sort());
  assert.equal(isCourseDesignMcpReadV1Scope(expectedFiles), true);
  assert.equal(isCourseDesignMcpReadV1Scope([...expectedFiles, 'netlify.toml']), false);
  assert.equal(isCourseDesignMcpReadV1Scope([...expectedFiles].slice(1)), false);
  const replaced = [...expectedFiles];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isCourseDesignMcpReadV1Scope(replaced), false);
});

test('profile runs exactly eight bounded stages', () => {
  assert.deepEqual(courseDesignMcpReadV1Commands.map((item) => item.label), [
    'install',
    'syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const node = courseDesignMcpReadV1Commands.find((item) => item.label === 'focused-node-contracts');
  assert.deepEqual(node?.args, [
    '--test', 'tests/trainingos-agent-gateway/course-design-mcp-read-v1.test.mjs',
  ]);
  const python = courseDesignMcpReadV1Commands.find((item) => item.label === 'focused-python-contracts');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v', 'tests.test_trainingos_course_design_mcp_read_v1',
  ]);
});

test('fixed exact-head counts and suite name are locked', () => {
  const source = readFileSync(
    new URL('../scripts/run-course-design-mcp-read-v1-profile.mjs', import.meta.url),
    'utf8',
  );
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 10;',
    'const EXPECTED_PYTHON_COUNT = 10;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'course-design-mcp-read-v1'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes Course Design MCP before inherited generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunCourseDesignMcpReadV1Profile } from './run-course-design-mcp-read-v1-profile.mjs';"), true);
  const courseDesign = router.indexOf('maybeRunCourseDesignMcpReadV1Profile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(courseDesign >= 0 && fallback > courseDesign);
});

test('public profile has no network, database, browser, provider or deploy command', () => {
  const text = JSON.stringify(courseDesignMcpReadV1Commands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy',
    'supabase db', 'psql', 'playwright', 'bash -c', 'sh -c',
    'tencent', 'http://', 'https://',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
