# Private exact-head focused and owned CI

This repository includes a manual-only workflow that checks out one exact commit from the private TrainingOS repository and runs two independent validations:

```text
W4-3 focused Python contract: 19/19 required
canonical repository ci:owned: complete required
```

## Required secret

Create one Actions repository secret:

```text
PRIVATE_REPO_READ_TOKEN
```

Use a fine-grained token restricted to `moseszhu999/training-learning-rails` with repository contents read access only. Do not grant write, administration, workflow, deployment, package, or organization permissions.

## Run procedure

1. Open **Actions**.
2. Select **Private exact-head focused and owned CI**.
3. Choose **Run workflow**.
4. Paste the exact lowercase 40-character private commit SHA.
5. Leave browser acceptance disabled unless it is explicitly required.

The focused command is fixed in the workflow:

```text
python -m unittest -v tests/test_trainingos_wave4_deliverable_evidence_contract.py
```

The focused result is accepted only when the process exits successfully, unittest reports `OK`, and exactly 19 tests ran.

## Public-log boundary

Both private commands write their complete output only to ephemeral runner files. The public workflow exposes only:

- requested exact SHA;
- focused PASS or FAIL and the sanitized count out of 19;
- `ci:owned` PASS or FAIL;
- last completed or failed owned step;
- timestamps, exit codes, and runtime summary.

The workflow does not upload the private checkout, raw logs, reports, build output, or test artifacts. It removes the checkout and both sealed logs before completing.

## Trigger boundary

The workflow supports `workflow_dispatch` only. It must never be enabled for pull requests, pushes, schedules, reusable calls, or external events while it can access the private read credential.
