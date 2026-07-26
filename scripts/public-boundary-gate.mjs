import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const selfPath = 'scripts/public-boundary-gate.mjs';
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', '.cache', '.tmp']);
const forbiddenExtensions = new Set(['.docx', '.pdf', '.xlsx', '.xls', '.zip', '.pem', '.key', '.p12']);
const forbiddenExactNames = new Set(['credentials.json']);
const forbiddenPrefixes = ['service-account'];

const contentRules = [
  {
    name: 'high-privilege role token',
    pattern: new RegExp(['service', 'role'].join('_'), 'i'),
  },
  {
    name: 'hosted backend domain',
    pattern: new RegExp(['supabase', '\\.co'].join(''), 'i'),
  },
  {
    name: 'JWT-like value',
    pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  },
  {
    name: 'UUID-like identifier',
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  },
  {
    name: 'customer project marker',
    pattern: new RegExp(['J', 'H', 'C'].join(''), 'i'),
  },
];

async function collectFiles(directory, relative = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(relative, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

function checkFileName(relativePath) {
  const baseName = path.basename(relativePath);
  const extension = path.extname(baseName).toLowerCase();
  const failures = [];

  if (forbiddenExtensions.has(extension)) failures.push(`forbidden extension ${extension}`);
  if (baseName === '.env' || baseName.startsWith('.env.')) failures.push('environment file');
  if (forbiddenExactNames.has(baseName)) failures.push(`forbidden credential filename ${baseName}`);
  if (forbiddenPrefixes.some((prefix) => baseName.startsWith(prefix))) {
    failures.push(`forbidden credential filename prefix in ${baseName}`);
  }

  return failures;
}

async function checkContents(file) {
  if (file.relativePath === selfPath) return [];

  const fileStat = await stat(file.absolutePath);
  if (fileStat.size > 2_000_000) return ['file exceeds public mirror size limit'];

  const buffer = await readFile(file.absolutePath);
  if (buffer.includes(0)) return ['binary content is not allowed'];

  const content = buffer.toString('utf8');
  return contentRules
    .filter((rule) => rule.pattern.test(content))
    .map((rule) => `content matched ${rule.name}`);
}

const files = await collectFiles(root);
const failures = [];

for (const file of files) {
  const reasons = [...checkFileName(file.relativePath), ...(await checkContents(file))];
  for (const reason of reasons) failures.push(`${file.relativePath}: ${reason}`);
}

if (failures.length) {
  console.error('Public boundary gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Public boundary gate passed for ${files.length} files.`);
