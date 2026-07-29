import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage5Profile,
} from './run-private-profile-stage5.mjs';

const SAFE_TEST_MODULE = /^test_[a-z0-9_]{1,120}$/;
const PYTHON_FAILURE_LINE = /\((?:tests\.)?(test_[a-z0-9_]+)\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+\)\s+\.\.\.\s+(?:FAIL|ERROR)\s*$/gm;

export function sanitizePythonFailureIdentifiers(text) {
  const identifiers = [];
  for (const match of String(text ?? '').matchAll(PYTHON_FAILURE_LINE)) {
    const moduleName = match[1];
    if (!SAFE_TEST_MODULE.test(moduleName) || identifiers.includes(moduleName)) continue;
    identifiers.push(moduleName);
    if (identifiers.length === 5) break;
  }
  return identifiers.length ? Object.freeze(identifiers) : Object.freeze(['unknown']);
}

async function readOwnedProfileLog(runnerTemp) {
  try {
    return await readFile(path.join(runnerTemp, 'trainingos-profile-2.log'), 'utf8');
  } catch {
    return '';
  }
}

export async function runProfile(input) {
  const result = await runStage5Profile(input);
  if (
    input.profile !== 'generic-owned'
    || result.ok
    || !result.failedLabels.includes('owned-python-contracts')
  ) {
    return result;
  }

  const pythonFailureIdentifiers = sanitizePythonFailureIdentifiers(
    await readOwnedProfileLog(input.runnerTemp),
  );

  return {
    ...result,
    status: `${result.status}|py=${pythonFailureIdentifiers.join(',')}`,
    pythonFailureIdentifiers,
  };
}

export { formatProfileStatus, profileCommands };
