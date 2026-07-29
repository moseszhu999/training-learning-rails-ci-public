# TrainingOS Public Latest-Main Release Gate

## Purpose

The `main-release` profile is a release-readiness gate for the exact current head of the private `main` branch. It does not deploy, publish, mutate the private repository, or replace feature-branch exact-head validation.

## Immutable dispatch contract

Use `.github/workflows/trainingos-public-exact-head.yml` with:

```text
validationProfile=main-release
privateExactSha=<lowercase private main SHA>
expectedMainSha=<same SHA>
expectedBaseSha=<same SHA>
expectedChangedFileCount=0
expectedMigrationRange=none
expectedFocusedTestCounts=node=0;python=0
expectedMigrationCount=<canonical bootstrap count>
runFreshReplay=true
runUpgradeReplay=true
runApplicationContracts=true
runTypecheck=true
runProductionBuild=true
runCriticalE2E=true
```

`privateExactSha`, `expectedMainSha`, the separately checked-out private `main` ref, and `expectedBaseSha` must all resolve to the same exact commit. A feature branch cannot satisfy this contract.

## Stages

The gate reports each stage independently:

- exact private SHA checkout and exact private-main equality;
- full-history fresh database replay;
- cleanup, second-pass replay, and deterministic repeat;
- previous-main to exact-main existing-project upgrade replay;
- canonical database contracts;
- fixed focused Node and Python contracts;
- fixed application contracts;
- TypeScript typecheck;
- production build without deployment;
- critical role and permission contracts;
- critical Teacher Queue, Persistent Agent, and Student Learning SQL E2E;
- zero-residue verification;
- canonical migration count, first/last migration, and aggregate content fingerprint.

## Verdicts

The only final verdicts are:

```text
PASS
FAIL
BASELINE_FAILURE
INFRASTRUCTURE_BLOCKED
NOT_RUN
```

A disabled or skipped required stage produces `NOT_RUN`, never `PASS`. A deterministic contract failure on the already-current private main is classified as `BASELINE_FAILURE`. Exact-main mismatch, expected migration-count mismatch, or another release-contract mismatch is `FAIL`. Infrastructure signatures, including a Vercel free-tier deployment-rate-limit message, are `INFRASTRUCTURE_BLOCKED`; the gate itself never invokes a deployment.

## Security boundary

- repository permissions remain `contents: read`;
- `PRIVATE_REPO_READ_TOKEN` is used only by `actions/checkout`;
- every private checkout uses `persist-credentials=false`;
- private source and raw logs stay runner-local with restrictive permissions;
- no artifact upload is permitted;
- no migration SQL body, database URL, secret, or private log is printed;
- cleanup removes private checkouts, temporary worktrees, database workdirs, and sealed logs;
- no private push, production deployment, Supabase link/push, Netlify deploy, or Vercel deploy is performed.

## Known-main dry-run lock

The implementation dry run is pinned to:

```text
privateExactSha=836d16dd3404f5f211dacb14fbaedcd514776b18
expectedMainSha=836d16dd3404f5f211dacb14fbaedcd514776b18
expectedBaseSha=836d16dd3404f5f211dacb14fbaedcd514776b18
expectedChangedFileCount=0
expectedMigrationCount=303
```

The canonical count is read from the exact-main bootstrap manifest rather than inferred from a stale historical run. The run ID and stage verdicts belong in the Draft PR after hosted execution. Local public-repository contracts do not substitute for the private latest-main run.

## One-off cleanup

The merged PR #338 one-off workflows `pr338-final-v5.yml` and `pr338-final-v6.yml` are superseded and removed by this change. The merged PR #339 one-off workflows and runners are also removed after the public boundary gate confirmed they were obsolete. Open or still-referenced carriers are not deleted. Future PR-specific carriers should be closed after immutable evidence is recorded and should not be merged into public `main` when a reusable profile covers the same scope.
