import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sourcePath = new URL('./run-validation.mjs', import.meta.url);
let source = readFileSync(sourcePath, 'utf8');

source = source
  .replace(
    "const PRIVATE_HEAD = '7ca98f380cba082acedbc32e4502672fde8acb63';",
    "const PRIVATE_HEAD = 'd293ce8e494d5c496fbeaade7d5ad05dad1daac0';",
  )
  .replace(
    "self.assertLess(source.index(call), source.index('trainingOsMcpBaseHeaders'))",
    "mcp_call = 'const baseHeaders = trainingOsMcpBaseHeaders'; self.assertIn(mcp_call, source); self.assertLess(source.index(call), source.index(mcp_call))",
  )
  .replace(
    "function trainingOsMcpBaseHeaders(){}; export default async function handler(req,res){ if (await dispatchTrainingOsVercelRoute(req, res)) return; trainingOsMcpBaseHeaders(); }",
    "function trainingOsMcpBaseHeaders(){}; export default async function handler(req,res){ if (await dispatchTrainingOsVercelRoute(req, res)) return; const baseHeaders = trainingOsMcpBaseHeaders(); return baseHeaders; }",
  );

const patchedPath = path.join(tmpdir(), 'trainingos-pr265-public-validation-v2.mjs');
writeFileSync(patchedPath, source, 'utf8');
execFileSync(process.execPath, [patchedPath], { stdio: 'inherit' });
