# TrainingOS public exact-head CI

The public CI repository is the hosted validation controller. Private-repository Actions status is not a merge gate because those jobs may fail before executing repository commands.

## Lock the candidate

1. Fetch the private pull request immediately before validation.
2. Record the final lowercase 40-character head SHA and the expected merge-base SHA.
3. Recompute the exact changed-file count.
4. Declare `none` or the inclusive migration timestamp range.
5. Record the exact focused Node and Python test counts expected for that head.
6. Any later private commit invalidates the result. Trigger a new run with the new head; never inherit an earlier green result.

## Trigger the workflow

Run **TrainingOS public exact-head CI** with:

- `privateExactSha`
- `expectedBaseSha`
- `validationProfile`
- `expectedChangedFileCount`
- `expectedMigrationRange`
- `expectedFocusedTestCounts` in `node=N;python=N` format

The supported profiles are student learning execution, scheduling delivery, Agent Recipe, Classroom Explanation, Classroom Lark, Classroom Agent Queue, and generic owned validation. Profiles are fixed command maps; dispatch inputs cannot supply shell commands.

## Public and sealed evidence

Allowed public output is limited to the exact SHA, merge base, selected profile, changed-file and migration counts, focused test counts, stage counts, and PASS/FAIL/NOT_RUN status.

Private source, migration bodies, fixture values, raw test output, build output, environment values, credentials, and database rows remain in runner-local sealed files. No artifact is uploaded. Cleanup runs even when validation fails.

`PRIVATE_REPO_READ_TOKEN` must be a fine-grained credential with read-only access to the private repository. Checkout uses `persist-credentials=false`.

## Code CI versus database replay

The reusable workflow verifies code scope, fixed contract commands, type checking, bundles, and builds. It does not claim database replay.

Database replay is a separate isolated-database gate. It must use synthetic fixtures, avoid production and preview deployment, publish only bounded counts/status, and prove cleanup or rollback. A code-CI PASS cannot be relabeled as database PASS, and database PASS cannot replace exact-head code validation.

## Carrier lifecycle

A carrier remains open only while its exact private SHA is still the current final candidate and no replacement run covers that same SHA. Completed, moved, merged-target, replaced, and one-time diagnostic carriers receive a final comment and are closed without merge. Historical workflow runs and comments are retained.
