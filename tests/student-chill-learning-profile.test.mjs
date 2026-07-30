import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  isStudentChillLearningFiles,
  studentChillLearningProfileCommands,
} from '../scripts/run-private-profile-stage10.mjs';

const exactFiles = [
  'apps/training-web/src/RootApp.tsx',
  'apps/training-web/src/components/JhcStudentTrainingSurface.tsx',
  'apps/training-web/src/components/TrainingOsStudentChillLearningShell.tsx',
  'apps/training-web/src/lib/trainingos-student-chill-learning-adapter.ts',
  'apps/training-web/src/lib/trainingos-student-chill-learning-safe-adapter.ts',
  'apps/training-web/src/trainingos-student-chill-learning.css',
  'docs/architecture/trainingos-student-chill-learning-experience-v1.md',
  'docs/testing/trainingos-student-chill-learning-validation-v1.md',
  'tests/test_trainingos_student_chill_learning_role_boundary_v1.py',
  'tests/test_trainingos_student_chill_learning_shell_v1_contract.py',
  'tests/trainingos-ui-e2e/student-chill-learning-shell-v1.spec.ts',
];

test('student chill suite selects only the exact eleven-file migration-free surface', () => {
  assert.equal(isStudentChillLearningFiles(exactFiles), true);
  assert.equal(isStudentChillLearningFiles(exactFiles.slice(1)), false);
  assert.equal(isStudentChillLearningFiles([
    ...exactFiles,
    'supabase/migrations/20260731100000_forbidden.sql',
  ]), false);
  assert.equal(isStudentChillLearningFiles([
    ...exactFiles,
    'api/integrations/agents/mcp.mjs',
  ]), false);
  assert.equal(isStudentChillLearningFiles([
    ...exactFiles,
    'apps/training-web/src/components/TrainingOsAdvancedManagementSurface.tsx',
  ]), false);
});

test('student chill suite fixes component, role, typecheck, build and Playwright commands', () => {
  const commands = studentChillLearningProfileCommands.map((item) => ({
    label: item.label,
    executable: item.executable,
    args: [...item.args],
    kind: item.kind,
  }));
  assert.equal(commands.length, 5);
  assert.deepEqual(commands[0], {
    label: 'install', executable: 'npm', args: ['ci'], kind: 'status',
  });
  assert.deepEqual(commands[1], {
    label: 'component-role-contracts',
    executable: 'python',
    args: [
      '-m',
      'unittest',
      '-v',
      'tests.test_trainingos_student_chill_learning_shell_v1_contract',
      'tests.test_trainingos_student_chill_learning_role_boundary_v1',
    ],
    kind: 'python',
  });
  assert.deepEqual(commands[2], {
    label: 'typecheck', executable: 'npm', args: ['run', 'typecheck'], kind: 'status',
  });
  assert.deepEqual(commands[3], {
    label: 'production-build',
    executable: 'npx',
    args: ['vite', 'build', '--config', 'vite.config.ts'],
    kind: 'status',
  });
  assert.equal(commands[4].label, 'playwright');
  assert.equal(commands[4].executable, 'bash');
  assert.equal(path.basename(commands[4].args[0]), 'run-student-chill-learning-playwright.sh');
  assert.equal(commands[4].kind, 'status');
});

test('mock-only Playwright runner is exact-head locked and leaves zero artifacts', async () => {
  const script = await readFile(new URL('../scripts/run-student-chill-learning-playwright.sh', import.meta.url), 'utf8');
  assert.match(script, /rev-parse HEAD/);
  assert.match(script, /student-chill-learning-shell-v1\.spec\.ts/);
  assert.match(script, /VITE_SUPABASE_URL="http:\/\/127\.0\.0\.1:54321"/);
  assert.match(script, /--reporter=line/);
  assert.match(script, /--output="\$workdir\/results"/);
  assert.match(script, /artifacts=ZERO/);
  assert.doesNotMatch(script, /supabase\s+(start|db reset)/);
  assert.doesNotMatch(script, /upload-artifact|netlify|vercel/);
});
