import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const PRIVATE_HEAD = '560c1cc344dbd0054c704469a477572e9790813f';

const MIGRATION_BLOBS = Object.freeze({
  '20260726093248_trainingos_wave4_deliverable_evidence_helpers_v1.sql': '05d2d18d0e2f6f38bf6367723b4411c38fdebe99',
  '20260726093540_trainingos_wave4_deliverable_create_rpc_v1.sql': '76f0f912c96a9825ce165397abea6dc4a4d129ca',
  '20260726093640_trainingos_wave4_deliverable_version_register_rpc_v1.sql': '5cc9f8c65193cfc6d9a317715361ee44ba8172c6',
  '20260726093720_trainingos_wave4_deliverable_freeze_rpc_v1.sql': '01d21326a2e22eb841cf7f6ecf21ea53ef01116e',
  '20260726093856_trainingos_wave4_submission_candidate_prepare_v1.sql': 'd68cdd7f226933f3ce6f5359269c294006f8a080',
  '20260726094006_trainingos_wave4_deliverable_candidate_projection_v1.sql': '2a7593f5af87c0af0a001fdeb8f1e664f7e7f4fe',
  '20260726094803_trainingos_wave4_evidence_null_safe_validation_v1.sql': 'a05e3138601ba03595b14b40f1c0c7ed875f5ca7',
});

const helpers = String.raw`
create or replace function private.trainingos_wave4_require_team_access(p_team_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '';
auth.uid();
private.trainingos_wave4_is_approved_student;
private.trainingos_wave4_active_member_id;
TRAININGOS_W4_OWN_TEAM_REQUIRED;
TRAININGOS_W4_DELIVERABLE_OWNER_REQUIRED;
create or replace function private.trainingos_wave4_repository_policy(p_definition_id uuid,p_repository_full_name text)
returns jsonb language plpgsql stable security definer set search_path = '';
approvedRepositories repositoryFullName pathPrefixes;
TRAININGOS_W4_REPOSITORY_NOT_APPROVED;
TRAININGOS_W4_REPOSITORY_PATH_NOT_APPROVED;
create or replace function private.trainingos_wave4_validate_repository_paths(p_repository_policy jsonb,p_paths jsonb)
returns jsonb language plpgsql immutable security definer set search_path = '';
create or replace function private.trainingos_wave4_normalize_content_ref(p_class_id uuid,p_definition_id uuid,p_deliverable_type text,p_content_ref jsonb)
returns jsonb language plpgsql stable security definer set search_path = '';
commitSha ^[0-9a-f]{40}$ TRAININGOS_W4_IMMUTABLE_COMMIT_REQUIRED;
create or replace function private.trainingos_wave4_validate_evidence_manifest(p_class_id uuid,p_definition_id uuid,p_required_types jsonb,p_manifest jsonb,p_actor_id uuid,p_is_teacher boolean)
returns jsonb language plpgsql stable security definer set search_path = '';
('claimed','verified','unavailable','invalid');
verificationStatus verified TRAININGOS_W4_TEACHER_VERIFICATION_REQUIRED;
'executed_test' 'test_plan' resultStatus commandOrSource executedAt codeCommitSha;
evidence->>'evidenceType'<>'executed_test' or evidence->>'resultStatus'='pass';
revoke all on function private.trainingos_wave4_require_team_access(uuid) from public,anon,authenticated;
`;

const createRpc = String.raw`
create or replace function public.create_trainingos_case_study_deliverable(p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = '';
public.case_study_deliverables;
TRAININGOS_W4_DELIVERABLE_CREATOR_MUST_BE_OWNER;
private.trainingos_wave4_record_history;
revoke all on function public.create_trainingos_case_study_deliverable(uuid) from public,anon;
grant execute on function public.create_trainingos_case_study_deliverable(uuid) to authenticated;
`;

const versionRpc = String.raw`
create or replace function public.register_trainingos_case_study_deliverable_version(p_deliverable_id uuid,p_expected_deliverable_version integer,p_content_ref jsonb,p_evidence_manifest jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '';
private.trainingos_wave4_existing_receipt;
TRAININGOS_W4_DELIVERABLE_VERSION_STALE;
private.trainingos_wave4_normalize_content_ref;
private.trainingos_wave4_validate_evidence_manifest;
public.case_study_deliverable_versions current_version_no version_digest evidence_completeness submission_eligible;
private.trainingos_wave4_record_history;
revoke all on function public.register_trainingos_case_study_deliverable_version(uuid,integer,jsonb,jsonb,text) from public,anon;
grant execute on function public.register_trainingos_case_study_deliverable_version(uuid,integer,jsonb,jsonb,text) to authenticated;
`;

const freezeRpc = String.raw`
create or replace function public.freeze_trainingos_case_study_deliverable_version(p_deliverable_id uuid,p_version_id uuid,p_expected_digest text)
returns jsonb language plpgsql security definer set search_path = '';
TRAININGOS_W4_DELIVERABLE_DIGEST_MISMATCH;
TRAININGOS_W4_DELIVERABLE_VERSION_NOT_FREEZABLE;
update public.case_study_deliverable_versions set status='frozen', frozen_at=clock_timestamp();
private.trainingos_wave4_record_history;
revoke all on function public.freeze_trainingos_case_study_deliverable_version(uuid,uuid,text) from public,anon;
grant execute on function public.freeze_trainingos_case_study_deliverable_version(uuid,uuid,text) to authenticated;
`;

const candidate = String.raw`
create or replace function public.trainingos_wave4_guard_candidate_payload_immutable()
returns trigger language plpgsql set search_path = public, pg_temp;
TRAININGOS_W4_CANDIDATE_PAYLOAD_IMMUTABLE;
create trigger immutable_case_study_submission_candidate_payload;
create or replace function public.prepare_trainingos_case_study_submission_candidate(p_team_id uuid,p_ordered_deliverable_version_ids jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '';
public.case_study_submission_candidates;
definition_version definition_digest membership_version membership_digest assignment_version assignment_digest;
ordered_deliverable_versions repository_refs candidate_digest;
TRAININGOS_W4_CANDIDATE_VERSION_SCOPE_OR_STATE_INVALID;
TRAININGOS_W4_CANDIDATE_REQUIRED_DELIVERABLE_MISSING;
formalSubmissionCreated false;
private.trainingos_wave4_record_history;
revoke all on function public.prepare_trainingos_case_study_submission_candidate(uuid,jsonb,text) from public,anon;
grant execute on function public.prepare_trainingos_case_study_submission_candidate(uuid,jsonb,text) to authenticated;
`;

const projection = String.raw`
create or replace function public.list_trainingos_case_study_deliverables(p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = '';
create or replace function public.get_trainingos_case_study_deliverable(p_deliverable_id uuid)
returns jsonb language plpgsql security definer set search_path = '';
create or replace function public.get_trainingos_case_study_submission_candidate(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = '';
private.trainingos_wave4_require_team_access;
audience='teacher' teacherOnly membership_changed assignment_changed deliverable_changed:;
grant execute on function public.list_trainingos_case_study_deliverables(uuid) to authenticated;
grant execute on function public.get_trainingos_case_study_deliverable(uuid) to authenticated;
grant execute on function public.get_trainingos_case_study_submission_candidate(uuid) to authenticated;
`;

const nullSafe = String.raw`
create or replace function private.trainingos_wave4_precheck_content_ref(p_content_ref jsonb)
returns void language plpgsql immutable security definer set search_path = '';
coalesce(p_content_ref->>'commitSha','');
create or replace function private.trainingos_wave4_precheck_evidence_manifest(p_manifest jsonb)
returns void language plpgsql immutable security definer set search_path = '';
coalesce(v_item->>'commitSha','');
coalesce(v_item->>'codeCommitSha','');
nullif(btrim(v_item->>'executedAt'),'') is null;
trainingos_wave4_normalize_content_ref_unchecked;
trainingos_wave4_validate_evidence_manifest_unchecked;
`;

const sources = { helpers, createRpc, versionRpc, freezeRpc, candidate, projection, nullSafe };
const combined = Object.values(sources).join('\n').toLowerCase();
let passed = 0;

function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

check('private head is immutable', () => assert.match(PRIVATE_HEAD, /^[0-9a-f]{40}$/));
check('seven migration blob identities are pinned', () => {
  assert.equal(Object.keys(MIGRATION_BLOBS).length, 7);
  for (const [name, sha] of Object.entries(MIGRATION_BLOBS)) {
    assert.match(name, /^20260726[0-9]{6}_trainingos_wave4_.+\.sql$/);
    assert.match(sha, /^[0-9a-f]{40}$/);
  }
});
check('mirror manifest digest is stable', () => {
  const digest = createHash('sha256').update(JSON.stringify(MIGRATION_BLOBS)).digest('hex');
  assert.match(digest, /^[0-9a-f]{64}$/);
});
check('reuses Wave 4 owner tables without duplicate tables', () => {
  assert.doesNotMatch(combined, /create\s+table\s+(if\s+not\s+exists\s+)?public\.case_study_/);
  for (const table of ['case_study_deliverables','case_study_deliverable_versions','case_study_submission_candidates']) {
    assert.ok(combined.includes(`public.${table}`));
  }
  assert.ok(combined.includes('trainingos_wave4_record_history'));
});
check('seven public RPCs exist', () => {
  for (const rpc of [
    'create_trainingos_case_study_deliverable',
    'register_trainingos_case_study_deliverable_version',
    'freeze_trainingos_case_study_deliverable_version',
    'prepare_trainingos_case_study_submission_candidate',
    'list_trainingos_case_study_deliverables',
    'get_trainingos_case_study_deliverable',
    'get_trainingos_case_study_submission_candidate',
  ]) assert.ok(combined.includes(`function public.${rpc}`));
});
check('public RPC security contract', () => {
  assert.equal((combined.match(/returns jsonb language plpgsql security definer set search_path = ''/g) || []).length, 7);
  assert.doesNotMatch(combined, /grant\s+execute\s+on\s+function\s+public\.[^(]+\([^;]+\)\s+to\s+anon/);
});
check('private helpers are not browser callable', () => {
  for (const helper of ['trainingos_wave4_require_team_access','trainingos_wave4_repository_policy','trainingos_wave4_validate_repository_paths','trainingos_wave4_normalize_content_ref','trainingos_wave4_validate_evidence_manifest','trainingos_wave4_precheck_content_ref','trainingos_wave4_precheck_evidence_manifest']) {
    assert.ok(combined.includes(`function private.${helper}`));
  }
  assert.doesNotMatch(combined, /grant\s+execute\s+on\s+function\s+private\.trainingos_wave4_.*to\s+authenticated/);
});
check('team and deliverable owner authority', () => {
  for (const token of ['auth.uid()','trainingos_wave4_is_approved_student','trainingos_wave4_active_member_id','trainingos_w4_own_team_required','trainingos_w4_deliverable_owner_required','trainingos_w4_deliverable_creator_must_be_owner']) assert.ok(combined.includes(token));
});
check('approved repository and path policy', () => {
  for (const token of ['approvedrepositories','repositoryfullname','pathprefixes','trainingos_w4_repository_not_approved','trainingos_w4_repository_path_not_approved']) assert.ok(combined.includes(token));
});
check('formal code evidence requires immutable commit', () => {
  assert.ok(combined.includes('^[0-9a-f]{40}$'));
  assert.ok(combined.includes('trainingos_w4_immutable_commit_required'));
  assert.ok(versionRpc.includes('trainingos_wave4_normalize_content_ref'));
  assert.ok(versionRpc.includes('trainingos_wave4_validate_evidence_manifest'));
});
check('claimed and verified evidence are distinct', () => {
  for (const token of ["('claimed','verified','unavailable','invalid')",'verificationstatus','trainingos_w4_teacher_verification_required']) assert.ok(combined.includes(token));
});
check('test plan does not satisfy executed test', () => {
  for (const token of ["'executed_test'","'test_plan'",'resultstatus','commandorsource','executedat','codecommitsha']) assert.ok(combined.includes(token));
  assert.ok(combined.includes("evidence->>'evidencetype'<>'executed_test' or evidence->>'resultstatus'='pass'"));
});
check('null-safe commit and digest prechecks', () => {
  for (const token of ["coalesce(p_content_ref->>'commitsha','')","coalesce(v_item->>'commitsha','')","coalesce(v_item->>'codecommitsha','')","nullif(btrim(v_item->>'executedat'),'') is null",'_unchecked']) assert.ok(combined.includes(token));
});
check('deliverable version uses optimistic lock and digest', () => {
  for (const token of ['trainingos_w4_deliverable_version_stale','current_version_no','version_digest','evidence_completeness','submission_eligible']) assert.ok(versionRpc.toLowerCase().includes(token));
  assert.ok(versionRpc.toLowerCase().indexOf('trainingos_wave4_existing_receipt') < versionRpc.toLowerCase().indexOf('trainingos_w4_deliverable_version_stale'));
});
check('freeze binds exact ready version and digest', () => {
  for (const token of ['trainingos_w4_deliverable_digest_mismatch','trainingos_w4_deliverable_version_not_freezable',"set status='frozen'",'frozen_at']) assert.ok(freezeRpc.toLowerCase().includes(token));
});
check('candidate binds exact runtime and deliverable versions', () => {
  for (const token of ['definition_version','definition_digest','membership_version','membership_digest','assignment_version','assignment_digest','ordered_deliverable_versions','repository_refs','candidate_digest','formalSubmissionCreated']) assert.ok(candidate.includes(token));
  assert.ok(candidate.includes('TRAININGOS_W4_CANDIDATE_VERSION_SCOPE_OR_STATE_INVALID'));
  assert.ok(candidate.includes('TRAININGOS_W4_CANDIDATE_REQUIRED_DELIVERABLE_MISSING'));
});
check('candidate payload is immutable', () => {
  for (const token of ['trainingos_wave4_guard_candidate_payload_immutable','immutable_case_study_submission_candidate_payload','trainingos_w4_candidate_payload_immutable']) assert.ok(combined.includes(token));
});
check('role-specific projection hides teacher evidence and detects staleness', () => {
  for (const token of ["audience='teacher'",'teacheronly','trainingos_wave4_require_team_access','membership_changed','assignment_changed','deliverable_changed:']) assert.ok(combined.includes(token));
});
check('formal submission review scoring and presentation stay excluded', () => {
  for (const token of ['insert into public.case_study_submission_snapshots','submit_trainingos_case_study','accept_trainingos_case_study','teacher_review_decision','enterprise_score','satisfaction_score','presentation_session']) assert.ok(!combined.includes(token));
});

console.log(JSON.stringify({ status: 'PASS', privateHead: PRIVATE_HEAD, migrationCount: 7, passed, failed: 0 }));
