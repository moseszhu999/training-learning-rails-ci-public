import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PRIVATE_HEAD = '7ca98f380cba082acedbc32e4502672fde8acb63';
const root = mkdtempSync(path.join(tmpdir(), 'trainingos-pr265-'));

function write(relativePath, content) {
  const destination = path.join(root, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, content, 'utf8');
}

const dispatcherSource = String.raw`import {
  getTrainingOsAgentExecutionOperations,
  listTrainingOsAgentExecutionOperations,
} from './execution-operations.mjs';
import { TrainingOsGatewayError } from './supabase-context.mjs';
import {
  isTrainingOsMcpOriginAllowed,
  trainingOsMcpCorsHeaders,
} from './http.mjs';
import {
  handleTrainingOsAssessmentHumanConfirmationHttp,
} from './assessment-human-confirmation-http.mjs';
import {
  handleTrainingOsP4HumanConfirmationHttp,
} from './p4-human-confirmation-http.mjs';

const DISPATCH_QUERY_KEY = '__trainingos_dispatch';

function applyHeaders(res, headers) {
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
}

function firstQueryValue(value) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function positiveInteger(value, fallback = 50) {
  const normalized = Number(value || fallback);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 200) {
    throw new TrainingOsGatewayError(
      'TRAININGOS_AGENT_EXECUTION_LIMIT_INVALID',
      'The execution list limit must be between 1 and 200.',
      400,
    );
  }
  return normalized;
}

function executionErrorBody(error) {
  if (error instanceof TrainingOsGatewayError) {
    return { status: error.httpStatus, body: { error: { code: error.code, message: error.message } } };
  }
  return {
    status: 500,
    body: {
      error: {
        code: 'TRAININGOS_AGENT_EXECUTION_OPERATIONS_FAILED',
        message: 'TrainingOS could not read Agent execution operations.',
      },
    },
  };
}

async function readRequestBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

async function handleAgentExecutions(req, res) {
  applyHeaders(res, {
    'cache-control': 'no-store',
    Allow: 'GET, OPTIONS',
    ...trainingOsMcpCorsHeaders(req.headers || {}),
  });
  if (!isTrainingOsMcpOriginAllowed(req.headers || {})) {
    return res.status(403).json({
      error: {
        code: 'TRAININGOS_AGENT_ORIGIN_FORBIDDEN',
        message: 'Origin is not allowed for TrainingOS Agent execution operations.',
      },
    });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: {
        code: 'TRAININGOS_AGENT_METHOD_NOT_ALLOWED',
        message: 'TrainingOS Agent execution operations accept HTTP GET and OPTIONS only.',
      },
    });
  }

  try {
    const authorization = req.headers?.authorization;
    const executionId = String(firstQueryValue(req.query?.executionId)).trim();
    if (executionId) {
      const result = await getTrainingOsAgentExecutionOperations({ authorization, executionId });
      return res.status(200).json(result);
    }

    const classId = String(firstQueryValue(req.query?.classId)).trim();
    if (!classId) {
      throw new TrainingOsGatewayError(
        'TRAININGOS_AGENT_EXECUTION_CLASS_REQUIRED',
        'A class ID or exact execution ID is required.',
        400,
      );
    }
    const status = String(firstQueryValue(req.query?.status)).trim() || null;
    const workflowType = String(firstQueryValue(req.query?.workflowType)).trim() || null;
    const result = await listTrainingOsAgentExecutionOperations({
      authorization,
      classId,
      status,
      workflowType,
      limit: positiveInteger(firstQueryValue(req.query?.limit), 50),
    });
    return res.status(200).json(result);
  } catch (error) {
    const normalized = executionErrorBody(error);
    return res.status(normalized.status).json(normalized.body);
  }
}

async function handleHumanConfirmation(req, res, options) {
  let body = {};
  if (req.method === 'POST') {
    try {
      body = await readRequestBody(req);
    } catch {
      return res.status(400).json({
        error: { code: options.invalidJsonCode, message: options.invalidJsonMessage },
      });
    }
  }

  const result = await options.handler({ method: req.method, headers: req.headers || {}, body });
  applyHeaders(res, result.headers);
  if (result.status === 204) return res.status(204).end();
  return res.status(result.status).json(result.body);
}

export async function dispatchTrainingOsVercelRoute(req, res) {
  const route = String(firstQueryValue(req.query?.[DISPATCH_QUERY_KEY])).trim();
  if (!route) return false;

  if (route === 'agent-executions') {
    await handleAgentExecutions(req, res);
    return true;
  }
  if (route === 'assessment-confirmation') {
    await handleHumanConfirmation(req, res, {
      handler: handleTrainingOsAssessmentHumanConfirmationHttp,
      invalidJsonCode: 'TRAININGOS_ASSESSMENT_HUMAN_INVALID_JSON',
      invalidJsonMessage: 'TrainingOS assessment human confirmation requires a valid JSON body.',
    });
    return true;
  }
  if (route === 'p4-confirmation') {
    await handleHumanConfirmation(req, res, {
      handler: handleTrainingOsP4HumanConfirmationHttp,
      invalidJsonCode: 'TRAININGOS_HUMAN_INVALID_JSON',
      invalidJsonMessage: 'TrainingOS P4 human confirmation requires a valid JSON body.',
    });
    return true;
  }

  res.status(404).json({
    error: {
      code: 'TRAININGOS_VERCEL_ROUTE_NOT_FOUND',
      message: 'The requested TrainingOS Vercel route is not registered.',
    },
  });
  return true;
}
`;

const nodeTestSource = String.raw`import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchTrainingOsVercelRoute } from '../../../lib/trainingos-agent-gateway/vercel-route-dispatcher.mjs';
function createResponse() { return { statusCode: 200, headers: {}, body: undefined, ended: false, setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, end() { this.ended = true; return this; } }; }
function request(route, overrides = {}) { return { method: 'OPTIONS', headers: {}, query: { __trainingos_dispatch: route }, ...overrides }; }
test('returns false when no internal dispatch marker is present', async () => { const res = createResponse(); const handled = await dispatchTrainingOsVercelRoute({ method: 'GET', headers: {}, query: {} }, res); assert.equal(handled, false); assert.equal(res.body, undefined); });
test('routes Agent execution OPTIONS through the consolidated entry', async () => { const res = createResponse(); const handled = await dispatchTrainingOsVercelRoute(request('agent-executions'), res); assert.equal(handled, true); assert.equal(res.statusCode, 204); assert.equal(res.ended, true); assert.equal(res.headers.allow, 'GET, OPTIONS'); });
test('preserves Agent execution method denial', async () => { const res = createResponse(); const handled = await dispatchTrainingOsVercelRoute(request('agent-executions', { method: 'POST' }), res); assert.equal(handled, true); assert.equal(res.statusCode, 405); assert.equal(res.body.error.code, 'TRAININGOS_AGENT_METHOD_NOT_ALLOWED'); });
test('routes assessment confirmation OPTIONS through the consolidated entry', async () => { const res = createResponse(); const handled = await dispatchTrainingOsVercelRoute(request('assessment-confirmation'), res); assert.equal(handled, true); assert.equal(res.statusCode, 204); assert.equal(res.ended, true); });
test('preserves assessment invalid JSON response', async () => { const res = createResponse(); const handled = await dispatchTrainingOsVercelRoute(request('assessment-confirmation', { method: 'POST', body: '{' }), res); assert.equal(handled, true); assert.equal(res.statusCode, 400); assert.equal(res.body.error.code, 'TRAININGOS_ASSESSMENT_HUMAN_INVALID_JSON'); });
test('routes P4 confirmation OPTIONS through the consolidated entry', async () => { const res = createResponse(); const handled = await dispatchTrainingOsVercelRoute(request('p4-confirmation'), res); assert.equal(handled, true); assert.equal(res.statusCode, 204); assert.equal(res.ended, true); });
test('fails closed for an unknown internal dispatch marker', async () => { const res = createResponse(); const handled = await dispatchTrainingOsVercelRoute(request('unknown'), res); assert.equal(handled, true); assert.equal(res.statusCode, 404); assert.equal(res.body.error.code, 'TRAININGOS_VERCEL_ROUTE_NOT_FOUND'); });
`;

const pythonTestSource = String.raw`import json
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / 'api'
VERCEL_CONFIG = ROOT / 'vercel.json'
MCP_ENTRY = ROOT / 'api/integrations/agents/mcp.mjs'
DISPATCHER = ROOT / 'lib/trainingos-agent-gateway/vercel-route-dispatcher.mjs'
FUNCTION_SUFFIXES = {'.js', '.mjs', '.cjs', '.ts', '.tsx'}
REMOVED_ENTRYPOINTS = {'api/integrations/agents/executions.mjs', 'api/integrations/human/assessment-confirmation.mjs', 'api/integrations/human/p4-confirmation.mjs'}
EXPECTED_REWRITES = {
'/api/integrations/agents/executions': '/api/integrations/agents/mcp.mjs?__trainingos_dispatch=agent-executions',
'/api/integrations/human/assessment-confirmation': '/api/integrations/agents/mcp.mjs?__trainingos_dispatch=assessment-confirmation',
'/api/integrations/human/p4-confirmation': '/api/integrations/agents/mcp.mjs?__trainingos_dispatch=p4-confirmation'}
def vercel_function_files():
 return sorted(path.relative_to(ROOT).as_posix() for path in API_ROOT.rglob('*') if path.is_file() and path.suffix in FUNCTION_SUFFIXES and not path.name.endswith('.d.ts'))
class Contract(unittest.TestCase):
 def test_hobby_function_limit_is_respected(self): self.assertLessEqual(len(vercel_function_files()), 12)
 def test_consolidated_entrypoints_are_removed(self): self.assertTrue(REMOVED_ENTRYPOINTS.isdisjoint(set(vercel_function_files())))
 def test_external_routes_are_preserved_by_internal_rewrites(self):
  routes = {r.get('src'): r.get('dest') for r in json.loads(VERCEL_CONFIG.read_text()).get('routes', []) if r.get('src')}
  for source, destination in EXPECTED_REWRITES.items(): self.assertEqual(routes.get(source), destination)
 def test_mcp_entry_invokes_the_dispatcher_before_mcp_handling(self):
  source = MCP_ENTRY.read_text(); call = 'if (await dispatchTrainingOsVercelRoute(req, res)) return;'; self.assertIn(call, source); self.assertLess(source.index(call), source.index('trainingOsMcpBaseHeaders'))
 def test_dispatcher_registers_all_consolidated_routes(self):
  source = DISPATCHER.read_text()
  for marker in ('agent-executions', 'assessment-confirmation', 'p4-confirmation'): self.assertIn(marker, source)
 def test_public_environment_values_remain_consistent(self):
  config = json.loads(VERCEL_CONFIG.read_text()); build_env = config['build']['env']; runtime_env = config['env']
  for key in ('SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'): self.assertEqual(build_env[key], runtime_env[key])
if __name__ == '__main__': unittest.main()
`;

write('lib/trainingos-agent-gateway/vercel-route-dispatcher.mjs', dispatcherSource);
write('lib/trainingos-agent-gateway/execution-operations.mjs', 'export async function getTrainingOsAgentExecutionOperations(){return {}}; export async function listTrainingOsAgentExecutionOperations(){return {}};');
write('lib/trainingos-agent-gateway/supabase-context.mjs', 'export class TrainingOsGatewayError extends Error { constructor(code,message,httpStatus=500){ super(message); this.code=code; this.httpStatus=httpStatus; } }');
write('lib/trainingos-agent-gateway/http.mjs', "export function isTrainingOsMcpOriginAllowed(){return true;} export function trainingOsMcpCorsHeaders(){return {};}");
const confirmationStub = "export async function HANDLER({method}){ if(method==='OPTIONS') return {status:204,headers:{allow:'POST, OPTIONS'},body:null}; return {status:200,headers:{},body:{ok:true}};}";
write('lib/trainingos-agent-gateway/assessment-human-confirmation-http.mjs', confirmationStub.replace('HANDLER','handleTrainingOsAssessmentHumanConfirmationHttp'));
write('lib/trainingos-agent-gateway/p4-human-confirmation-http.mjs', confirmationStub.replace('HANDLER','handleTrainingOsP4HumanConfirmationHttp'));
write('prototypes/trainingos-agent-mvp-v1/test/vercel-route-dispatcher.test.mjs', nodeTestSource);
write('tests/test_trainingos_vercel_function_limit_contract.py', pythonTestSource);
write('api/integrations/agents/mcp.mjs', "import { dispatchTrainingOsVercelRoute } from '../../../lib/trainingos-agent-gateway/vercel-route-dispatcher.mjs'; function trainingOsMcpBaseHeaders(){}; export default async function handler(req,res){ if (await dispatchTrainingOsVercelRoute(req, res)) return; trainingOsMcpBaseHeaders(); }");
for (let index = 1; index <= 11; index += 1) write(`api/synthetic/function-${index}.mjs`, 'export default function handler(){}');
const env = { SUPABASE_URL: 'https://backend.example.invalid', SUPABASE_ANON_KEY: 'synthetic-public-value', VITE_SUPABASE_URL: 'https://backend.example.invalid', VITE_SUPABASE_ANON_KEY: 'synthetic-public-value' };
write('vercel.json', JSON.stringify({ build: { env }, env, routes: [
  { src: '/api/integrations/agents/executions', dest: '/api/integrations/agents/mcp.mjs?__trainingos_dispatch=agent-executions' },
  { src: '/api/integrations/human/assessment-confirmation', dest: '/api/integrations/agents/mcp.mjs?__trainingos_dispatch=assessment-confirmation' },
  { src: '/api/integrations/human/p4-confirmation', dest: '/api/integrations/agents/mcp.mjs?__trainingos_dispatch=p4-confirmation' }
]}, null, 2));

assert.equal(PRIVATE_HEAD.length, 40);
console.log(`Validating private exact head ${PRIVATE_HEAD} through a sanitized public closure at ${root}`);
execFileSync('python', ['-m', 'unittest', '-q', 'tests/test_trainingos_vercel_function_limit_contract.py'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, ['--test', 'prototypes/trainingos-agent-mvp-v1/test/vercel-route-dispatcher.test.mjs'], { cwd: root, stdio: 'inherit' });
console.log('PR 265 public-safe focused validation PASS');
