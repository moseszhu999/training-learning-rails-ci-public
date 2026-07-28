#!/usr/bin/env python3
"""Dependency-order migration files in an isolated CI checkout.

SQL content is never changed. The script discovers hard object-existence
requirements, applies a stable topological order, breaks true cycles by the
original version order, and assigns synthetic unique 14-digit versions.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timedelta
import heapq
from pathlib import Path
import re
import subprocess


TABLE_CREATE = re.compile(
    r"create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?([a-z_][a-z0-9_]*)",
    re.IGNORECASE,
)
FUNCTION_CREATE = re.compile(
    r"create(?:\s+or\s+replace)?\s+function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(",
    re.IGNORECASE,
)
TYPE_CREATE = re.compile(
    r"create\s+type\s+(?:public\.)?([a-z_][a-z0-9_]*)",
    re.IGNORECASE,
)
PUBLIC_REF = re.compile(r"\bpublic\.([a-z_][a-z0-9_]*)", re.IGNORECASE)
FUNCTION_DDL_REF = re.compile(
    r"(?:"
    r"\b(?:grant|revoke)\b[^;]{0,500}?\bon\s+function"
    r"|\b(?:alter|comment\s+on|drop)\s+function(?:\s+if\s+exists)?"
    r")\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(",
    re.IGNORECASE,
)
ALTER_TABLE_STATEMENT = re.compile(
    r"alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)"
    r"(?P<body>[\s\S]{0,3000}?)(?=;)",
    re.IGNORECASE,
)
ADD_COLUMN = re.compile(
    r"add\s+column(?:\s+if\s+not\s+exists)?\s+([a-z_][a-z0-9_]*)",
    re.IGNORECASE,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("migration_root", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    return parser.parse_args()


def git_created(path: Path) -> int:
    result = subprocess.run(
        ["git", "log", "--diff-filter=A", "--format=%ct", "--", str(path)],
        check=False,
        capture_output=True,
        text=True,
    )
    values = [int(item) for item in result.stdout.split() if item.isdigit()]
    return min(values) if values else 0


def base_key(path: Path) -> tuple[int, int, int, str]:
    prefix = path.name.split("_", 1)[0]
    if len(prefix) == 8 and prefix.isdigit():
        return (int(prefix), 0, git_created(path), path.name)
    if len(prefix) == 14 and prefix.isdigit():
        return (int(prefix[:8]), 1, int(prefix[8:]), path.name)
    return (99_999_999, 9, 0, path.name)


def first_owner(
    mapping: dict[object, Path],
    name: object,
    path: Path,
    keys: dict[Path, tuple[int, int, int, str]],
) -> None:
    current = mapping.get(name)
    if current is None or keys[path] < keys[current]:
        mapping[name] = path


def main() -> int:
    args = parse_args()
    root = args.migration_root
    report_path = args.report
    paths = sorted(root.glob("*.sql"))
    if not paths:
        report_path.write_text("status=NO_MIGRATIONS", encoding="utf-8")
        return 2

    texts = {path: path.read_text(encoding="utf-8", errors="replace") for path in paths}
    keys = {path: base_key(path) for path in paths}

    table_owner: dict[object, Path] = {}
    function_creators: dict[str, list[Path]] = defaultdict(list)
    type_owner: dict[object, Path] = {}
    column_owner: dict[object, Path] = {}

    for path in paths:
        text = texts[path]
        for name in TABLE_CREATE.findall(text):
            first_owner(table_owner, name.lower(), path, keys)
        for name in FUNCTION_CREATE.findall(text):
            normalized = name.lower()
            if path not in function_creators[normalized]:
                function_creators[normalized].append(path)
        for name in TYPE_CREATE.findall(text):
            first_owner(type_owner, name.lower(), path, keys)
        for match in ALTER_TABLE_STATEMENT.finditer(text):
            table = match.group(1).lower()
            for column in ADD_COLUMN.findall(match.group("body")):
                first_owner(column_owner, (table, column.lower()), path, keys)

    for creators in function_creators.values():
        creators.sort(key=lambda path: keys[path])

    adjacency = {path: set() for path in paths}
    edge_reasons: dict[tuple[Path, Path], list[str]] = defaultdict(list)

    def add_edge(producer: Path | None, consumer: Path, reason: str) -> None:
        if producer is None or producer == consumer:
            return
        adjacency[producer].add(consumer)
        edge_reasons[(producer, consumer)].append(reason)

    for consumer in paths:
        text = texts[consumer]
        refs = {name.lower() for name in PUBLIC_REF.findall(text)}
        function_ddl_refs = {name.lower() for name in FUNCTION_DDL_REF.findall(text)}
        for name in refs:
            add_edge(table_owner.get(name), consumer, f"table:{name}")
            add_edge(type_owner.get(name), consumer, f"type:{name}")
        for name in function_ddl_refs:
            creators = function_creators.get(name, [])
            producer = next((path for path in creators if path != consumer), None)
            add_edge(producer, consumer, f"function-ddl:{name}")
        lower_text = text.lower()
        for (table, column), producer in column_owner.items():
            if table in refs and re.search(rf"\b{re.escape(column)}\b", lower_text):
                add_edge(producer, consumer, f"column:{table}.{column}")

    indegree = {path: 0 for path in paths}
    for consumers in adjacency.values():
        for consumer in consumers:
            indegree[consumer] += 1

    heap: list[tuple[tuple[int, int, int, str], Path]] = []
    for path in paths:
        if indegree[path] == 0:
            heapq.heappush(heap, (keys[path], path))

    ordered: list[Path] = []
    processed: set[Path] = set()
    cycle_breaks = 0
    while len(ordered) < len(paths):
        if not heap:
            candidate = min((path for path in paths if path not in processed), key=lambda path: keys[path])
            heapq.heappush(heap, (keys[candidate], candidate))
            cycle_breaks += 1
        _, path = heapq.heappop(heap)
        if path in processed:
            continue
        processed.add(path)
        ordered.append(path)
        for consumer in adjacency[path]:
            indegree[consumer] -= 1
            if indegree[consumer] == 0:
                heapq.heappush(heap, (keys[consumer], consumer))

    staging = root / ".dependency-order-staging"
    if staging.exists():
        raise FileExistsError(f"staging path already exists: {staging}")
    staging.mkdir()
    staged: list[tuple[Path, str]] = []
    for index, path in enumerate(ordered):
        suffix = path.name.split("_", 1)[1] if "_" in path.name else path.name
        staged_path = staging / f"{index:06d}_{suffix}"
        path.rename(staged_path)
        staged.append((staged_path, suffix))

    start = datetime(2000, 1, 1, 0, 0, 0)
    final_names: list[str] = []
    for index, (staged_path, suffix) in enumerate(staged):
        version = (start + timedelta(seconds=index)).strftime("%Y%m%d%H%M%S")
        target = root / f"{version}_{suffix}"
        staged_path.rename(target)
        final_names.append(target.name)
    staging.rmdir()

    edge_count = sum(len(consumers) for consumers in adjacency.values())
    report_path.write_text(
        " ".join(
            [
                "status=PASS",
                f"count={len(final_names)}",
                f"edges={edge_count}",
                f"cycle_breaks={cycle_breaks}",
                f"first={final_names[0]}",
                f"last={final_names[-1]}",
            ]
        ),
        encoding="utf-8",
    )
    print(len(final_names))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
