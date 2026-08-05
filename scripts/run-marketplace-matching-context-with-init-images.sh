#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

readonly runner_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-marketplace-matching-context-database.sh"
readonly -a primary_images=(
  "supabase/postgres:17.6.1.106"
  "supabase/gotrue:v2.188.1"
  "supabase/realtime:v2.86.3"
  "supabase/storage-api:v1.54.1"
)
readonly -a mirror_images=(
  "public.ecr.aws/supabase/postgres:17.6.1.106"
  "public.ecr.aws/supabase/gotrue:v2.188.1"
  "public.ecr.aws/supabase/realtime:v2.86.3"
  "public.ecr.aws/supabase/storage-api:v1.54.1"
)

cleanup_images() {
  docker image rm "${primary_images[@]}" "${mirror_images[@]}" >/dev/null 2>&1 || true
  rm -f "$RUNNER_TEMP"/trainingos-marketplace-matching-context-init-image-*.log
}
trap cleanup_images EXIT

pull_with_retries() {
  local image="$1" log_path="$2" attempt
  : >"$log_path"
  for attempt in 1 2 3; do
    if docker pull "$image" >>"$log_path" 2>&1; then
      return 0
    fi
    sleep $((attempt * 5))
  done
  return 1
}

prefetch_one() {
  local index="$1" primary mirror label primary_log mirror_log
  primary="${primary_images[$index]}"
  mirror="${mirror_images[$index]}"
  label="$(printf '%s' "$primary" | tr '/:.' '-')"
  primary_log="$RUNNER_TEMP/trainingos-marketplace-matching-context-init-image-${label}-primary.log"
  mirror_log="$RUNNER_TEMP/trainingos-marketplace-matching-context-init-image-${label}-mirror.log"

  if pull_with_retries "$primary" "$primary_log"; then
    :
  elif pull_with_retries "$mirror" "$mirror_log"; then
    docker tag "$mirror" "$primary" >/dev/null 2>&1
  else
    echo "MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=init-image-prefetch-${label}"
    return 1
  fi

  docker image inspect "$primary" --format '{{.Id}}' >/dev/null
}

for index in "${!primary_images[@]}"; do
  prefetch_one "$index"
done

bash "$runner_script"
