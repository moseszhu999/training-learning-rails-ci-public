# TrainingOS Public CI Mirror

This repository is an isolated, history-free CI mirror for public-safe TrainingOS components.

## Purpose

- Run generic unit and contract tests on GitHub-hosted standard runners.
- Use synthetic fixtures only.
- Keep customer materials, production identifiers, live integrations, deployment metadata, and internal validation evidence out of the public repository.

## Security boundary

This repository must not contain:

- customer documents or source archives;
- production or test backend URLs, keys, project references, or JWTs;
- real classroom, student, profile, document, batch, or deployment identifiers;
- live end-to-end scripts that access external systems;
- private repository history, pull-request evidence, or internal operational reports.

Every change runs a public-boundary scan before unit tests. Files should enter this repository only through an explicit allowlist and synthetic-data review.

## Local verification

```bash
npm run check
```

The private TrainingOS repository remains the system of record. This repository is not a deployment source and must not be connected to production services.
