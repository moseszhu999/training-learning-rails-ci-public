import assert from 'node:assert/strict';

const PRIVATE_HEAD = '78087753695e773d7ad8f01c1973a7f99a8ce1cb';

const successorPattern = /or\s+exists\s*\(\s*select\s+1\s+from\s+public\.trainingos_assessment_publications\s+child\s+where\s+child\.supersedes_publication_id\s*=\s*v_publication\.id\s*\)/gi;
const projectionPattern = /and\s+not\s+exists\s*\(\s*select\s+1\s+from\s+public\.trainingos_assessment_publications\s+child\s+where\s+child\.supersedes_publication_id\s*=\s*p\.id\s*\)/gi;

function matchCount(source, pattern) {
  return [...source.matchAll(new RegExp(pattern.source, pattern.flags))].length;
}

function patchAttemptValidator(source) {
  if (source.includes("operation = 'INSERT' and exists") && source.includes('child.supersedes_publication_id = publication.id')) {
    return source;
  }
  assert.equal(matchCount(source, successorPattern), 1, 'validator baseline must match exactly once');
  return source.replace(
    successorPattern,
    "or (operation = 'INSERT' and exists (select 1 from public.trainingos_assessment_publications child where child.supersedes_publication_id = publication.id))",
  );
}

function patchProjection(source) {
  if (
    source.includes('existing_attempt.publication_id = publication.id')
    && source.includes('existing_attempt.student_id = actor_id')
  ) {
    return source;
  }
  assert.equal(matchCount(source, projectionPattern), 1, 'projection baseline must match exactly once');
  return source.replace(
    projectionPattern,
    `and (
      not exists (
        select 1 from public.trainingos_assessment_publications child
        where child.supersedes_publication_id = publication.id
      )
      or exists (
        select 1 from public.trainingos_assessment_attempts existing_attempt
        where existing_attempt.publication_id = publication.id
          and existing_attempt.student_id = actor_id
      )
    )`,
  );
}

function patchExistingAttemptRpc(source) {
  if (matchCount(source, successorPattern) === 0) {
    assert.match(source, /publication_status\s*<>\s*'published'/i);
    assert.match(source, /close_at\s+is\s+not\s+null\s+and\s+current_time\s*>\s*close_at/i);
    return source;
  }
  assert.equal(matchCount(source, successorPattern), 1, 'RPC baseline must match exactly once');
  const patched = source.replace(successorPattern, '');
  assert.match(patched, /publication_status\s*<>\s*'published'/i);
  assert.match(patched, /close_at\s+is\s+not\s+null\s+and\s+current_time\s*>\s*close_at/i);
  return patched;
}

const multilineValidator = `
if publication_status <> 'published'
   or exists (
     select 1
     from public.trainingos_assessment_publications child
     where child.supersedes_publication_id = v_publication.id
   )
   or (close_at is not null and current_time > close_at)
then reject; end if;`;

const compactValidator = "if publication_status <> 'published' or exists ( select 1 from public.trainingos_assessment_publications child where child.supersedes_publication_id = v_publication.id ) or (close_at is not null and current_time > close_at) then reject; end if;";

const multilineProjection = `
where publication_status in ('published', 'closed', 'superseded')
  and not exists (
    select 1 from public.trainingos_assessment_publications child
    where child.supersedes_publication_id = p.id
  )`;

const compactProjection = "where publication_status in ('published','closed','superseded') and not exists ( select 1 from public.trainingos_assessment_publications child where child.supersedes_publication_id = p.id )";

const startRpc = compactValidator;
const saveRpc = compactValidator;
const submitRpc = compactValidator;

const patchedValidatorMain = patchAttemptValidator(multilineValidator);
const patchedValidatorAhead = patchAttemptValidator(compactValidator);
assert.match(patchedValidatorMain, /operation = 'INSERT' and exists/);
assert.match(patchedValidatorAhead, /operation = 'INSERT' and exists/);
assert.equal(patchAttemptValidator(patchedValidatorMain), patchedValidatorMain, 'validator patch must be idempotent');

const patchedProjectionMain = patchProjection(multilineProjection);
const patchedProjectionAhead = patchProjection(compactProjection);
for (const source of [patchedProjectionMain, patchedProjectionAhead]) {
  assert.match(source, /existing_attempt\.publication_id = publication\.id/);
  assert.match(source, /existing_attempt\.student_id = actor_id/);
  assert.match(source, /not exists/);
}
assert.equal(patchProjection(patchedProjectionMain), patchedProjectionMain, 'projection patch must be idempotent');

const patchedSave = patchExistingAttemptRpc(saveRpc);
const patchedSubmit = patchExistingAttemptRpc(submitRpc);
for (const source of [patchedSave, patchedSubmit]) {
  assert.doesNotMatch(source, /supersedes_publication_id/);
  assert.match(source, /publication_status <> 'published'/);
  assert.match(source, /close_at is not null and current_time > close_at/);
}
assert.equal(patchExistingAttemptRpc(patchedSave), patchedSave, 'existing-attempt patch must be idempotent');

assert.match(startRpc, /supersedes_publication_id/, 'new-attempt start guard must remain');
assert.throws(
  () => patchAttemptValidator(`${multilineValidator}\n${multilineValidator}`),
  /validator baseline must match exactly once/,
  'ambiguous baselines must fail closed',
);

console.log(JSON.stringify({
  status: 'PASS',
  privateHead: PRIVATE_HEAD,
  cases: {
    multilineBaseline: true,
    compactSchemaAheadBaseline: true,
    newAttemptGuardRetained: true,
    existingAttemptVisibility: true,
    existingAttemptSaveAllowedBeforeClose: true,
    existingAttemptSubmitAllowedBeforeClose: true,
    originalCloseGuardRetained: true,
    idempotentReplay: true,
    ambiguousBaselineRejected: true,
  },
}));
