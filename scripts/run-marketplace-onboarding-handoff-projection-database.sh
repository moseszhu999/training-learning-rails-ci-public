#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

readonly bin_dir="$RUNNER_TEMP/trainingos-marketplace-onboarding-handoff-bin"
readonly core_runner="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-marketplace-onboarding-handoff-projection-database-core.sh"

cleanup_wrapper(){
  rm -rf "$bin_dir"
}
trap cleanup_wrapper EXIT

mkdir -p "$bin_dir"
cat >"$bin_dir/supabase" <<'WRAPPER'
#!/usr/bin/env bash
exec npx --yes supabase@2.109.1 "$@"
WRAPPER
chmod 700 "$bin_dir/supabase"
export PATH="$bin_dir:$PATH"

supabase --version >/dev/null
bash "$core_runner"
