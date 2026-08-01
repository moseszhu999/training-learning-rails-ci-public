import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage13Profile,
} from './run-private-profile-stage13.mjs';

const teacherHubCommands = profileCommands['teacher-hub'];
const mountIndex = teacherHubCommands.findIndex((item) => item.label === 'python-mount');
const acceptanceIndex = teacherHubCommands.findIndex((item) => item.label === 'python-acceptance');
if (mountIndex < 0 || acceptanceIndex < 0) {
  throw new Error('teacher-hub mount and acceptance commands are required');
}

const mountClass = 'tests.test_trainingos_teacher_operations_hub_mount_contract.TeacherOperationsHubMountContractTest';
const acceptanceClass = 'tests.test_trainingos_teacher_operations_hub_acceptance_contract.TeacherOperationsHubAcceptanceContractTest';
const mountMethods = [
  ['mount-route-unique', 'test_advanced_route_remains_unique_and_no_new_route_family_exists'],
  ['mount-default-menu', 'test_today_operations_is_default_advanced_landing_and_menu_label'],
  ['mount-light-mode', 'test_light_mode_is_preserved'],
  ['mount-teacher-only', 'test_teacher_only_advanced_hub_and_student_routing'],
  ['mount-read-only', 'test_hub_is_read_only_and_has_no_runtime_or_direct_data_access'],
  ['mount-five-regions', 'test_all_five_read_only_regions_are_present'],
  ['mount-state-contracts', 'test_unavailable_empty_error_loading_and_stale_contracts_are_explicit'],
  ['mount-provider-agent', 'test_provider_and_agent_boundaries_are_visible'],
  ['mount-destination-allowlist', 'test_typed_destination_allowlist_prevents_arbitrary_urls'],
  ['mount-class-reset', 'test_class_switch_clears_local_page_state'],
  ['mount-no-sample', 'test_no_formal_sample_data_is_mounted'],
  ['mount-responsive', 'test_responsive_desktop_tablet_and_mobile_rules_exist'],
];
const acceptanceMethods = [
  ['accept-model-isolation', 'test_merged_adapter_is_mounted_but_provided_test_model_remains_isolated'],
  ['accept-owner-composition', 'test_adapter_composes_existing_canonical_read_owners_only'],
  ['accept-source-context', 'test_view_model_exposes_source_evidence_stale_class_date_and_authorized_destination'],
  ['accept-fixture-isolation', 'test_fixture_is_explicitly_test_only_and_not_mounted_by_production_routes'],
  ['accept-state-matrix', 'test_state_projection_matrix_is_complete_and_fail_closed'],
  ['accept-destinations', 'test_fixture_destinations_use_merged_canonical_kinds_and_hashes'],
  ['accept-queue-binding', 'test_teacher_queue_deep_links_are_exact_owner_bound'],
  ['accept-class-reset', 'test_class_switch_clears_selection_and_disclosure_and_is_browser_covered'],
  ['accept-responsive', 'test_desktop_and_tablet_visual_widths_assert_no_horizontal_overflow'],
  ['accept-role-matrix', 'test_role_matrix_denies_non_teacher_and_agent_human_authority'],
  ['accept-live-gate', 'test_live_suite_covers_one_day_loop_and_session_cleanup_under_explicit_gate'],
  ['accept-no-runtime-write', 'test_acceptance_scope_adds_no_runtime_migration_write_or_hidden_sample_fallback'],
];

function methodCommands(className, methods) {
  return methods.map(([label, method]) => ({
    label,
    executable: 'python',
    args: ['-m', 'unittest', '-v', `${className}.${method}`],
    kind: 'python',
  }));
}

const firstIndex = Math.min(mountIndex, acceptanceIndex);
const secondIndex = Math.max(mountIndex, acceptanceIndex);
teacherHubCommands.splice(secondIndex, 1);
teacherHubCommands.splice(firstIndex, 1, ...methodCommands(mountClass, mountMethods), ...methodCommands(acceptanceClass, acceptanceMethods));

export async function runProfile(input) {
  return runStage13Profile(input);
}

export { formatProfileStatus, profileCommands };
