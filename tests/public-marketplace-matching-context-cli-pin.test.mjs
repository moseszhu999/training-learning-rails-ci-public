import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const database = readFileSync(
  new URL('../scripts/run-marketplace-matching-context-database.sh', import.meta.url),
  'utf8',
);

test('matching context database replay pins the repository-standard Supabase CLI', () => {
  assert.match(database, /exec npx --yes supabase@2\.101\.0 "\$@"/);
  assert.doesNotMatch(database, /supabase@latest/);
});

test('CLI pin does not weaken exact base, replay, E2E, ACL or cleanup gates', () => {
  for (const marker of [
    'start_with_marker "$upgrade" baseline-start',
    'start_with_marker "$fresh" fresh-start',
    'run_e2e "$fresh" fresh-one',
    'run_e2e "$fresh" fresh-two',
    'run_e2e "$upgrade" upgrade',
    'TRAININGOS_MARKETPLACE_MATCHING_CONTEXT_PROJECTION_V1_E2E_PASS',
    "grep -qx 'authenticated_execute=true'",
    "grep -qx 'anon_execute=false'",
    "grep -qx 'public_execute=false'",
    'zero_residue=PASS',
    'cleanup=PASS',
  ]) assert.ok(database.includes(marker), marker);
});
