export const releaseStatuses = Object.freeze([
  'PASS',
  'FAIL',
  'BASELINE_FAILURE',
  'INFRASTRUCTURE_BLOCKED',
  'NOT_RUN',
]);

const INFRASTRUCTURE_PATTERNS = [
  /vercel[^\n]*(?:free[- ]tier|deployment)[^\n]*(?:rate[- ]limit|too many|limit exceeded)/i,
  /(?:docker|supabase)[^\n]*(?:daemon unavailable|cannot connect|connection refused|timed out|rate[- ]limit)/i,
  /no space left on device|\bENOSPC\b/i,
  /temporary failure in name resolution|network is unreachable/i,
];

export function classifyCommandFailure(text, { baseline = true } = {}) {
  if (INFRASTRUCTURE_PATTERNS.some((pattern) => pattern.test(text ?? ''))) {
    return 'INFRASTRUCTURE_BLOCKED';
  }
  return baseline ? 'BASELINE_FAILURE' : 'FAIL';
}

export function computeFinalVerdict({ allRequested, stages, explicitFailureClasses = [] }) {
  const values = Object.values(stages ?? {});
  if (!allRequested) return 'NOT_RUN';
  if (explicitFailureClasses.includes('INFRASTRUCTURE_BLOCKED')) return 'INFRASTRUCTURE_BLOCKED';
  if (explicitFailureClasses.includes('FAIL')) return 'FAIL';
  if (explicitFailureClasses.includes('BASELINE_FAILURE')) return 'BASELINE_FAILURE';
  if (values.some((value) => value === 'FAIL')) return 'FAIL';
  if (values.some((value) => value === 'NOT_RUN')) return 'NOT_RUN';
  if (values.length > 0 && values.every((value) => value === 'PASS')) return 'PASS';
  return 'NOT_RUN';
}

export function finalizeControllerVerdict({
  publicContracts,
  inputValidation,
  credential,
  scope,
  runnerVerdict,
}) {
  if (publicContracts === 'FAIL' || inputValidation === 'FAIL' || scope === 'FAIL') return 'FAIL';
  if (credential === 'FAIL') return 'INFRASTRUCTURE_BLOCKED';
  if (releaseStatuses.includes(runnerVerdict)) return runnerVerdict;
  return 'NOT_RUN';
}
