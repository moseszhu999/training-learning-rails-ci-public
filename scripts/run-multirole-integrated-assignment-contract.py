from __future__ import annotations

import importlib
import os
import sys
import unittest
from pathlib import Path


def main() -> int:
    private_repo = Path(os.environ["PRIVATE_REPO_PATH"]).resolve()
    sys.path.insert(0, str(private_repo))

    module = importlib.import_module(
        "tests.test_trainingos_class_operations_assignment_v1"
    )
    case = module.ClassOperationsAssignmentV1Contract
    loader = unittest.TestLoader()
    names = [
        name
        for name in loader.getTestCaseNames(case)
        if name != "test_01_changed_files_are_exactly_the_three_owned_files"
    ]
    if len(names) != 14:
        raise RuntimeError("TRAININGOS_ASSIGNMENT_INTEGRATED_TEST_COUNT_MISMATCH")

    suite = unittest.TestSuite(case(name) for name in names)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
