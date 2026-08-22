# AtoN public exact-head CI

This public carrier validates the private repository
`moseszhu999/dalian-aton-intelligent-review` when private-repository Actions
cannot provide usable hosted evidence.

## Fixed boundary

- The workflow checks out one caller-supplied exact commit SHA only.
- The repository name and validation profile are fixed in the workflow.
- The existing carrier read-only secret `PRIVATE_REPO_READ_TOKEN` is used only
  for the private checkout.
- The validator emits bounded counts and closed failure labels.
- No private source, raw document, customer material, or log artifact is uploaded.
- The private checkout is deleted in an `always()` cleanup step.
- This profile validates the requirements/specification repository; it does not
  implement or execute the AtoN domain runtime.

## Run

After this PR is merged, use the public repository Actions UI:

`.github/workflows/aton-public-exact-head.yml`

Inputs:

- `privateExactSha`: exact 40-character SHA from the private repository.
- `validationProfile`: fixed to `aton-requirements`.

The existing public carrier secret `PRIVATE_REPO_READ_TOKEN` must have
read-only access to the private AtoN repository. It must not be printed or
copied into the repository.

## Verdict

The fixed profile returns:

- `PASS`
- `FAIL`
- `EXACT_SHA_MISMATCH`
- `REQUIRED_FILES_MISSING`
- `MARKDOWN_LINK_INVALID`
- `YAML_PARSE_ERROR`
- `RAW_MATERIAL_FOUND`
- `PROTOTYPE_RESOURCE_INVALID`

The private repository remains the source of truth. This public repository is
only a validation carrier.
