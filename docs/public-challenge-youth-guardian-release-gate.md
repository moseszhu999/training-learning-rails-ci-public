# Public Challenge Youth Guardian Release Gate

## Decision

Formal public Challenge release is blocked unless the exact private candidate contains and passes the merged Youth Guardian and Minor Safety contracts.

This gate applies to the reusable public `challenge-web` profile. It is not a new one-off workflow and it does not allow request-controlled commands.

## Fixed stage

After the existing Challenge Web profile completes, the controller executes exactly:

```text
python -m unittest discover \
  -s tests \
  -p 'test_trainingos_youth_guardian_*.py' \
  -v
```

The command output remains in a runner-local mode-restricted sealed log. The public result exposes only:

```text
youth_guardian_gate=PASS|FAIL
```

and one fixed failure label:

```text
youth-guardian-contract-missing
youth-guardian-contract-failed
```

## Release semantics

A successful process exit with zero discovered tests is a failure. This prevents a public Challenge candidate from becoming releasable before the canonical Youth Guardian runtime and its safety contracts are merged into the exact private head.

A PASS requires:

- at least one matching Youth Guardian test;
- all matching tests passing;
- the existing Challenge Web scope, Python boundary, typecheck, production bundle, and Playwright stages also passing.

Existing Web evidence recorded before this gate is historical technical evidence only and is not formal release authorization.

## Required private safety coverage

The private Youth Guardian contract family is expected to lock, at minimum:

- minor identity and guardian relationship binding;
- age-policy resolution;
- purpose-specific guardian consent;
- separate disclosure authorization for public Proof/share;
- revocation, expiry, purpose mismatch, tenant mismatch, and stale revision denial;
- guardian-limited projection without raw Agent conversation, private teacher notes, peer evaluation, secret drafts, or unconfirmed sensitive inference;
- teacher confirmation where the resolved policy requires it;
- auditability and human override boundaries.

The public controller does not reimplement those business rules. It requires the canonical private contracts to exist and pass on the exact checked-out head.

## Security boundary

- exact read-only private checkout;
- `persist-credentials=false`;
- fixed executable and arguments;
- no private source or test output published;
- no artifact upload;
- no deployment;
- no production database access or write;
- runner-local sealed logs removed by the existing cleanup path.
