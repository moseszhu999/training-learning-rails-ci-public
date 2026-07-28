#!/usr/bin/env python3
"""Normalize migration filenames in an isolated checkout for dependency replay.

The script never changes SQL content. It discovers coarse table, function, type,
and added-column dependencies, condenses cycles, applies a stable topological
order, and assigns synthetic unique 14-digit versions for a clean local replay.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timedelta
import heapq
from pathlib import Path
import re
import subprocess
from typing import Iterable


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
PUBLIC_CALL = re.compile(r"\bpublic\.([a-z_][a-z0-9_]*)\s*\(", re.IGNORECASE)
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


def strongly_connected_components(
    paths: Iterable[Path], adjacency: dict[Path, set[Path]]
) -> list[list[Path]]:
    counter = [0]
    stack: list[Path] = []
    on_stack: set[Path] = set()
    indices: dict[Path, int] = {}
    lowlink: dict[Path, int] = {}
    components: list[list[Path]] = []

    def strongconnect(node: Path) -> None:
        indices[node] = counter[0]
        lowlink[node] = counter[0]
        counter[0] += 1
        stack.append(node)
        on_stack.add(node)

        for neighbor in adjacency[node]:
            if neighbor not in indices:
                strongconnect(neighbor)
                lowlink[node] = min(lowlink[node], lowlink[neighbor])
            elif neighbor in on_stack:
                lowlink[node] = min(lowlink[node], indices[neighbor])

        if lowlink[node] == indices[node]:
            component: list[Path] = []
            while True:
                member = stack.pop()
                on_stack.remove(member)
                component.append(member)
                if member == node:
                    break
            components.append(component)

    for path in paths:
        if path not in indices:
            strongconnect(path)
    return components


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
    function_owner: dict[object, Path] = {}
    type_owner: dict[object, Path] = {}
    column_owner: dict[object, Path] = {}

    for path in paths:
        text = texts[path]
        for name in TABLE_CREATE.findall(text):
            first_owner(table_owner, name.lower(), path, keys)
        for name in FUNCTION_CREATE.findall(text):
            first_owner(function_owner, name.lower(), path, keys)
        for name in TYPE_CREATE.findall(text):
            first_owner(type_owner, name.lower(), path, keys)
        for match in ALTER_TABLE_STATEMENT.finditer(text):
            table = match.group(1).lower()
            for column in ADD_COLUMN.findall(match.group("body")):
                first_owner(column_owner, (table, column.lower()), path, keys)

    adjacency = {path: set() for path in paths}
    edge_reasons: dict[tuple[Path, Path], list[str]] = defaultdict(list)

    def add_edge(producer: Path | None, consumer: Path, reason: str) -> None:
        if producer is None or producer == consumer:
            return
        if consumer not in adjacency[producer]:
            adjacency[producer].add(consumer)
        edge_reasons[(producer, consumer)].append(reason)

    for consumer in paths:
        text = texts[consumer]
        refs = {name.lower() for name in PUBLIC_REF.findall(text)}
        calls = {name.lower() for name in PUBLIC_CALL.findall(text)}
        for name in refs:
            add_edge(table_owner.get(name), consumer, f"table:{name}")
            add_edge(type_owner.get(name), consumer, f"type:{name}")
        for name in calls:
            add_edge(function_owner.get(name), consumer, f"function:{name}")
        lower_text = text.lower()
        for (table, column), producer in column_owner.items():
            if table in refs and re.search(rf"\b{re.escape(column)}\b", lower_text):
                add_edge(producer, consumer, f"column:{table}.{column}")

    components = strongly_connected_components(paths, adjacency)
    component_of: dict[Path, int] = {}
    for component_id, members in enumerate(components):
        for member in members:
            component_of[member] = component_id

    component_edges = {component_id: set() for component_id in range(len(components))}
    indegree = {component_id: 0 for component_id in range(len(components))}
    for producer, consumers in adjacency.items():
        producer_component = component_of[producer]
        for consumer in consumers:
            consumer_component = component_of[consumer]
            if producer_component == consumer_component:
                continue
            if consumer_component not in component_edges[producer_component]:
                component_edges[producer_component].add(consumer_component)
                indegree[consumer_component] += 1

    component_key = {
        component_id: min(keys[member] for member in members)
        for component_id, members in enumerate(components)
    }
    heap: list[tuple[tuple[int, int, int, str], int]] = []
    for component_id in range(len(components)):
        if indegree[component_id] == 0:
            heapq.heappush(heap, (component_key[component_id], component_id))

    ordered_components: list[int] = []
    while heap:
        _, component_id = heapq.heappop(heap)
        ordered_components.append(component_id)
        for neighbor in sorted(component_edges[component_id], key=lambda item: component_key[item]):
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                heapq.heappush(heap, (component_key[neighbor], neighbor))

    if len(ordered_components) != len(components):
        report_path.write_text("status=COMPONENT_DAG_FAILURE", encoding="utf-8")
        return 2

    ordered_paths: list[Path] = []
    cyclic_components = 0
    for component_id in ordered_components:
        members = sorted(components[component_id], key=lambda path: keys[path])
        if len(members) > 1:
            cyclic_components += 1
        ordered_paths.extend(members)

    staging = root / ".dependency-order-staging"
    if staging.exists():
        raise FileExistsError(f"staging path already exists: {staging}")
    staging.mkdir()
    staged: list[tuple[Path, str]] = []
    for index, path in enumerate(ordered_paths):
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
                f"components={len(components)}",
                f"cyclic_components={cyclic_components}",
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
