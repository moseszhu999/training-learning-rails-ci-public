# Private exact-head owned CI

This repository includes a manual-only workflow that checks out one exact commit from the private TrainingOS repository and runs its repository-owned CI script.

## Required secret

Create one Actions repository secret:

```text
PRIVATE_REPO_READ_TOKEN
```

Use a fine-grained token restricted to `moseszhu999/training-learning-rails` with repository contents read access only. Do not grant write, administration, workflow, deployment, package, or organization permissions.

## Run procedure

1. Open **Actions**.
2. Select **Private exact-head owned CI**.
3. Choose **Run workflow**.
4. Paste the exact lowercase 40-character private commit SHA.
5. Leave browser acceptance disabled unless it is explicitly required.

## Public-log boundary

The private test command writes its complete output only to the ephemeral runner. The public workflow exposes only:

- requested exact SHA;
- PASS or FAIL;
- last completed or failed step;
- timestamps, exit code, and runtime summary.

The workflow does not upload the private checkout, raw logs, reports, build output, or test artifacts. It removes the checkout and sealed log before completing.

## Trigger boundary

The workflow supports `workflow_dispatch` only. It must never be enabled for pull requests, pushes, schedules, reusable calls, or external events while it can access the private read credential.
