import path from 'node:path';

const SAFE_ROOTS = [
  'apps/training-web/src/',
  'packages/',
  'scripts/',
  'tests/',
  'vite.config.ts',
  'playwright.config.ts',
];

function safeRelativePath(rawPath) {
  const normalized = rawPath.replaceAll('\\', '/').replace(/^.*?\/(apps|packages|scripts|tests)\//, '$1/');
  if (normalized.endsWith('vite.config.ts')) return 'vite.config.ts';
  if (normalized.endsWith('playwright.config.ts')) return 'playwright.config.ts';
  return SAFE_ROOTS.some((root) => normalized.startsWith(root)) ? normalized : path.basename(normalized);
}

export function sanitizeTypeScriptDiagnostics(text, limit = 12) {
  const found = [];
  const seen = new Set();
  const pattern = /(?:^|\n)([^\n(]+)\((\d+),(\d+)\):\s+error\s+(TS\d+):/g;
  for (const match of text.matchAll(pattern)) {
    const item = `${safeRelativePath(match[1].trim())}:${match[2]}:${match[4]}`;
    if (!seen.has(item)) {
      seen.add(item);
      found.push(item);
    }
    if (found.length >= limit) break;
  }
  return found.join(',') || 'NO_STRUCTURED_DIAGNOSTIC';
}

export function sanitizeBuildSubstage(text) {
  const markers = [
    ['vite-build', /vite\s+build|building for production/i],
    ['vscode-bundle', /trainingos-classroom-vscode\/esbuild\.mjs|esbuild.*production/i],
    ['learning-workspace-validation', /run-trainingos-learning-workspace-bridge-validation\.mjs|learning workspace bridge/i],
    ['zero-permission-validation', /run-trainingos-zero-permission-bridge-validation\.mjs|zero-permission bridge/i],
    ['native-validation', /run-trainingos-native-classroom-validation\.mjs|native classroom/i],
  ];
  for (const [label, pattern] of markers) {
    if (pattern.test(text)) return label;
  }
  return 'unknown-build-substage';
}
