import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage6Profile,
} from './run-private-profile-stage6.mjs';
import { isYouthLearningFiles } from './run-private-profile-stage5.mjs';

async function changedFiles({ privateRepoPath, runnerTemp }) {
  const scopeText = await readFile(
    path.join(runnerTemp, 'trainingos-scope-contract.env'),
    'utf8',
  );
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync('git', [
    '-C',
    privateRepoPath,
    'diff',
    '--name-only',
    scope.expected_base_sha,
    process.env.PRIVATE_EXACT_SHA,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git failed');
  return result.stdout.trim() ? result.stdout.trim().split('\n') : [];
}

export async function runProfile(input) {
  let selectedSuite = null;
  if (input.profile === 'generic-owned') {
    const files = await changedFiles(input);
    if (isYouthLearningFiles(files)) selectedSuite = 'youth-learning';
  }

  const result = await runStage6Profile(input);
  return selectedSuite ? { ...result, selectedSuite } : result;
}

export { formatProfileStatus, profileCommands };
