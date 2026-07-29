# TrainingOS public exact-head CI

The public CI repository is the hosted validation controller. Private-repository Actions status is not accepted as hosted evidence when those jobs fail before executing repository commands.

## Lock the target

For a feature candidate, record the final lowercase 40-character private head SHA, exact merge-base SHA, changed-file count, migration range, and expected focused Node/Python counts immediately before dispatch. Any later private commit invalidates the run.

For `main-release`, lock the current private `main` head and use the same exact SHA for `privateExactSha`, `expectedMainSha`, and `expectedBaseSha`. The workflow independently checks out the live private `main` ref; a moved main cannot pass.

## Reusable profiles

Run `.github/workflows/trainingos-public-exact-head.yml` with a fixed `validationProfile`:

```text
student-learning-execution
scheduling-delivery
agent-recipe
classroom-explanation
classroom-lark
classroom-agent-queue
challenge-runtime
challenge-web
teacher-hub
docs-launch
generic-owned
main-release
```

Inputs may declare SHAs, counts, ranges, booleans, and a profile. They cannot supply shell commands, executables, arguments, SQL, or dynamic expressions.

- `challenge-runtime` preserves the focused Challenge Proof/Sharing contracts, declared scope and migration range, typecheck/build, isolated fresh replay, second pass, exact-base upgrade replay, fixed SQL E2E, rollback contract, and cleanup.
- `challenge-web` enforces the route allowlist, direct-Supabase prohibition, secret scan, typecheck, production build, and Playwright.
- `teacher-hub` enforces Hub mount and role contracts, deep-link/stale/offline validation, typecheck/build, and Playwright.
- `docs-launch` enforces docs-only scope, Markdown structure, secret/PII scanning, and no runtime, migration, UI, or Gateway delta.
- `main-release` enforces exact live private main, complete migration count and fingerprint, full-history fresh/second/upgrade replay, database and application contracts, Node/Python, typecheck/build, critical role E2E, and zero residue.

The reusable request driver may prepare a dispatch request, but it cannot weaken these profile contracts or turn a stale result green.

## Security and evidence boundary

- workflow permissions are `contents: read`;
- `PRIVATE_REPO_READ_TOKEN` is used only for read-only private checkout;
- every private checkout uses `persist-credentials=false`;
- private source and raw command output remain in mode-restricted runner-local files;
- no artifact is uploaded;
- no migration body, secret, database URL, raw row, or private log is printed;
- cleanup removes private checkouts, temporary worktrees, database workdirs, and sealed output;
- no production deployment or production database write is performed.

Public output is limited to exact SHAs, selected profile, bounded counts, named fixed stages, migration fingerprint metadata, failure labels from a fixed vocabulary, and a closed verdict.

## Verdicts

The release vocabulary is closed to:

```text
PASS
FAIL
BASELINE_FAILURE
INFRASTRUCTURE_BLOCKED
NOT_RUN
```

A stale SHA cannot pass. `NOT_RUN` is never GO. A deterministic current-main contract failure is `BASELINE_FAILURE`; infrastructure signatures remain `INFRASTRUCTURE_BLOCKED`, not PASS.

## Carrier lifecycle

One-time carriers are allowed only to bootstrap or diagnose the reusable controller. After immutable evidence is recorded, remove or close the carrier and retain its historical run. Do not create one workflow per private PR when a reusable profile covers the scope.
