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

The exact candidate, independently checked-out live private `main` ref, and expected base must all resolve to the same commit. A feature branch or stale main cannot satisfy this contract.

## Required stages

- full-history fresh database replay;
- deterministic second pass and cleanup;
- previous-main to exact-main existing-project upgrade replay;
- canonical database contracts;
- fixed focused Node and Python contracts;
- fixed application contracts;
- TypeScript typecheck;
- production build without deployment;
- critical role and permission contracts;
- Teacher Queue, Persistent Agent, and Student Learning SQL E2E;
- zero-residue verification;
- canonical migration count, first/last migration, and aggregate fingerprint.

## Verdicts

```text
PASS
FAIL
BASELINE_FAILURE
INFRASTRUCTURE_BLOCKED
NOT_RUN
```

A disabled or skipped required stage is `NOT_RUN`, never PASS. A deterministic failure already present on the exact current private main is `BASELINE_FAILURE`. Exact-main mismatch or migration-count mismatch is `FAIL`. Infrastructure signatures are `INFRASTRUCTURE_BLOCKED`; the gate itself never deploys.

## Security boundary

- `contents: read` only;
- private token used only for read-only checkout;
- `persist-credentials=false` on every private checkout;
- raw private output kept in runner-local sealed files;
- no artifact upload, migration body printing, database URL printing, deployment, or production database write;
- unconditional cleanup of checkouts, worktrees, database workdirs, and logs.

## Current exact-main evidence lock

The latest validated private-main candidate for this controller is:

```text
privateExactSha=5e9edc6b5c7c1d62d9441b3fd2db8d709296fff3
expectedMainSha=5e9edc6b5c7c1d62d9441b3fd2db8d709296fff3
expectedBaseSha=5e9edc6b5c7c1d62d9441b3fd2db8d709296fff3
expectedChangedFileCount=0
expectedMigrationCount=305
```

The former `836d16dd3404f5f211dacb14fbaedcd514776b18` lock is stale and is not current-main evidence.

The exact-main dry run reports `BASELINE_FAILURE`, not GO: database replay, upgrade, role E2E, and zero residue pass; fixed failures remain in student-exercise Python, assessment-resume Python, and Learning Workspace build validation. The reusable controller must preserve that failure until the private baseline is fixed and rerun on the then-current exact main.

## Carrier cleanup

The dry-run carrier exists only to validate the controller before merge. Record its immutable run, then remove the carrier from the final public-main change so future validation uses the reusable `main-release` profile rather than accumulating one-off workflows.
