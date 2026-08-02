import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TEACHER_HUB_ROLE_MENU_EXACT_FILES,
  isTeacherHubRoleMenuExactFiles,
} from '../scripts/verify-private-scope.mjs';

test('exact Teacher Hub role menu scope is accepted as one closed set', () => {
  assert.equal(TEACHER_HUB_ROLE_MENU_EXACT_FILES.length, 15);
  assert.equal(new Set(TEACHER_HUB_ROLE_MENU_EXACT_FILES).size, 15);
  assert.equal(isTeacherHubRoleMenuExactFiles(TEACHER_HUB_ROLE_MENU_EXACT_FILES), true);
});

test('Teacher Hub role menu scope rejects missing or extra files', () => {
  assert.equal(
    isTeacherHubRoleMenuExactFiles(TEACHER_HUB_ROLE_MENU_EXACT_FILES.slice(1)),
    false,
  );
  assert.equal(
    isTeacherHubRoleMenuExactFiles([
      ...TEACHER_HUB_ROLE_MENU_EXACT_FILES,
      'apps/training-web/src/components/UnexpectedSurface.tsx',
    ]),
    false,
  );
});

test('Teacher Hub role menu scope rejects migration substitution', () => {
  const replaced = [...TEACHER_HUB_ROLE_MENU_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260802000000_unexpected.sql';
  assert.equal(isTeacherHubRoleMenuExactFiles(replaced), false);
});

test('exact set locks preview functions permission owner and regression evidence', () => {
  for (const required of [
    'apps/training-web/src/lib/trainingos-role-menu-permissions.ts',
    'netlify/functions/trainingos-agent-executions.mjs',
    'netlify/functions/trainingos-mcp-preview-runtime.mjs',
    'tests/test_trainingos_role_menu_content_permissions_v1.py',
    'tests/test_trainingos_advanced_settings.py',
    'tests/test_trainingos_risk_intervention_ui_contract.py',
    'tests/test_trainingos_zero_permission_bridge_core_contract.py',
  ]) {
    assert.ok(TEACHER_HUB_ROLE_MENU_EXACT_FILES.includes(required), required);
  }
});
