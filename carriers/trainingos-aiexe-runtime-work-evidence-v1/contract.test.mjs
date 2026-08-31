import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};
const sha = (value) => `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
const CLAIM_KEYS = new Set(['status','workspaceId']);

function validateVector(vector) {
  assert.equal(vector.runtime.privateExactHead, manifest.privateExactHead);
  assert.equal(vector.runtime.upstreamRuntimeExactHead, manifest.upstreamRuntimeExactHead);
  assert.equal(vector.runtime.liveRuntimeInvoked, false);
  assert.equal(vector.protocol.family, 'openai.responses');
  assert.equal(vector.protocol.operation, 'responses.create');
  assert.equal(vector.protocol.riskClass, 'draft');
  assert.equal(vector.receipt.outcome, 'success');
  assert.ok(vector.receipt.statusCode >= 200 && vector.receipt.statusCode < 300);
  assert.equal(vector.artifact.kind, 'draft_text');
  assert.equal(vector.artifact.text, vector.providerResult.output_text);
  assert.equal(vector.receipt.responseDigest, sha(vector.providerResult));
  assert.equal(vector.outcome.outcome, 'success');
  assert.equal(vector.outcome.uncertainty, null);
  assert.equal(vector.outcome.retry.automaticRetryPerformed, false);
  for (const key of Object.keys(vector.claim)) assert.ok(CLAIM_KEYS.has(key), `claim field ${key} is unsupported`);
  assert.equal(vector.claim.status, 'success');
  assert.equal(vector.claim.workspaceId, vector.capability.workspaceId);
  for (const [key, expected] of Object.entries(manifest.boundaries)) {
    assert.equal(vector.boundaries[key], expected, `${key} must remain ${expected}`);
  }
  return true;
}

function validVector(text='Draft a bounded lesson outline.') {
  const providerResult = {id:'resp-fixture', output_text:text, model:'gpt-fixture'};
  return {
    runtime:{privateExactHead:manifest.privateExactHead,upstreamRuntimeExactHead:manifest.upstreamRuntimeExactHead,liveRuntimeInvoked:false},
    capability:{workspaceId:'workspace.training-fixture',actorRef:'agent.training-fixture',packageId:'capability.course-design-draft',version:'1.0.0'},
    protocol:{family:'openai.responses',operation:'responses.create',riskClass:'draft'},
    providerResult,
    artifact:{kind:'draft_text',text},
    receipt:{outcome:'success',statusCode:200,responseDigest:sha(providerResult)},
    outcome:{outcome:'success',uncertainty:null,retry:{automaticRetryPerformed:false}},
    claim:{status:'success',workspaceId:'workspace.training-fixture'},
    boundaries:{...manifest.boundaries},
  };
}

test('carrier is anchored to private PR 760 repaired exact head and AIEXE P3.1 exact head', () => {
  assert.equal(manifest.privatePullRequest, 760);
  assert.equal(manifest.privateExactHead, '01e461ce0fa79af930ac47125a9dfc389bc64fbf');
  assert.equal(manifest.upstreamRuntimeExactHead, '28c7dd539a4a5f340a715a230bd05ce1c386d925');
  assert.equal(manifest.proofMode, 'PUBLIC_CONTRACT_CARRIER');
  assert.equal(manifest.privateSourcePublished, false);
});

test('valid draft becomes useful work evidence only', () => assert.equal(validateVector(validVector()), true));

test('artifact must exactly equal provider output_text', () => {
  const v=validVector(); v.artifact.text='invented'; assert.throws(()=>validateVector(v));
});

test('response digest binds exact provider result', () => {
  const v=validVector(); v.providerResult.output_text='changed'; assert.throws(()=>validateVector(v));
});

test('runtime must stay non-live and exact-head pinned', () => {
  const v=validVector(); v.runtime.liveRuntimeInvoked=true; assert.throws(()=>validateVector(v));
});

test('protocol remains OpenAI Responses semantic draft', () => {
  const v=validVector(); v.protocol.riskClass='internalWrite'; assert.throws(()=>validateVector(v));
});

test('uncertain provider outcome is not accepted as useful completed work evidence', () => {
  const v=validVector(); v.outcome.outcome='uncertain'; v.outcome.uncertainty={effectMayHaveOccurred:true}; assert.throws(()=>validateVector(v));
});

test('persistent claim must match TrainingOS capability workspace', () => {
  const v=validVector(); v.claim.workspaceId='workspace.other'; assert.throws(()=>validateVector(v));
});

test('persistent claim rejects authority HumanGate and external-action truth fields', () => {
  for (const patch of [{authorityGrantCreated:true},{humanGateCreated:true},{externalActionPerformed:true}]) {
    const v=validVector(); Object.assign(v.claim, patch); assert.throws(()=>validateVector(v), /claim field .* is unsupported/);
  }
});

test('formal learning credential competency and authority truth remain false', () => {
  for (const key of ['formalLearningResultCreated','capabilityCredentialIssued','competencySatisfied','learningPlanMutated','authorityGrantCreated','humanGateCreated','externalActionPerformed']) {
    const v=validVector(); v.boundaries[key]=true; assert.throws(()=>validateVector(v), undefined, key);
  }
});

test('contract evidence is deterministic for same artifact and changes with exact artifact', () => {
  const a=validVector('draft one'); const b=validVector('draft one'); const c=validVector('draft two');
  assert.equal(sha(a),sha(b)); assert.notEqual(sha(a),sha(c));
});
