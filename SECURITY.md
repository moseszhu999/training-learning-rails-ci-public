# Security Policy

## Repository boundary

This repository is a public CI mirror. It must contain only generic source code, synthetic fixtures, public-safe tests, and CI configuration.

Do not commit:

- customer or learner documents;
- production, staging, or live-test configuration;
- privileged backend credentials or browser-facing backend configuration;
- real person, classroom, document, batch, deployment, or database identifiers;
- internal validation reports, operational notes, or private repository history;
- scripts that connect to live external systems.

## Reporting an exposure

Do not open a public issue containing the exposed value. Remove access where possible, rotate affected credentials when applicable, and report the incident through a private channel to the repository owner.

## Change rule

Every proposed change must pass `npm run check`. Passing automation is necessary but does not replace human review of whether the material is appropriate for public disclosure.
