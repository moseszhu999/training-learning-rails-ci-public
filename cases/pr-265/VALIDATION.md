# Validation contract

Source reference: private TrainingOS commit `7ca98f380cba082acedbc32e4502672fde8acb63`.

The public workflow executes:

1. the public boundary gate;
2. the existing synthetic unit suite;
3. a sanitized Python function-count and rewrite contract;
4. the exact route-dispatch behavior tests copied from the private head.

The broad private `ci:owned` suite is not represented as fully validated here because its complete dependency tree is not public-safe. Only the focused function-limit and dispatcher scope is asserted by this case.
