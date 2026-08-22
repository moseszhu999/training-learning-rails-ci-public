#!/usr/bin/env python3
"""Public-safe AtoN exact-head validator.

The private repository is checked out by the workflow. This validator emits only
bounded status labels and counts; it never prints private source content.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

try:
    import yaml
except ImportError:
    print("ATON_CI_RESULT=FAIL")
    print("ATON_CI_FAILURE=VALIDATOR_DEPENDENCY_MISSING")
    raise SystemExit(1)

ROOT = Path(os.environ.get("ATON_REPO_PATH", "private-aton")).resolve()
EXPECTED_SHA = os.environ.get("ATON_EXPECTED_SHA", "").lower()
ERRORS: set[str] = set()
MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
HTML_RESOURCE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""", re.IGNORECASE)

REQUIRED_FILES = [
    "README.md", "AGENTS.md", "CLAUDE.md",
    *[f"docs/{number:02d}-{name}.md" for number, name in [
        (1, "PRD"), (2, "BUSINESS-FLOW"), (3, "SCOPE-PRIORITY"),
        (4, "ACCEPTANCE"), (5, "OPEN-QUESTIONS"), (6, "BOUNDARIES"),
        (7, "GLOSSARY"), (8, "RULE-SCHEMA"), (9, "GOLDEN-CASES"),
        (10, "CASE-001-XIZHONGDAO"), (11, "REUSE-AND-SCALE-ARCHITECTURE"),
        (12, "DOMAIN-DATA-MODEL"), (13, "NATIONWIDE-PLATFORM-ROADMAP"),
        (14, "CASE-002-HUAYUANKOU"), (15, "SPATIAL-CALCULATION-CONTRACT"),
        (16, "CASE-003-TAIPINGWAN"), (17, "MVP-DOMAIN-SERVICE-CONTRACT"),
        (18, "IMPLEMENTATION-SLICE-001"), (19, "AI-NATIVE-PLATFORM-INTEGRATION"),
    ]],
    "specs/golden-cases/case-001-xizhongdao.yaml",
    "specs/rules/xizhongdao-candidates.yaml",
    "specs/golden-cases/case-002-huayuankou.yaml",
    "specs/rules/huayuankou-candidates.yaml",
    "specs/fixtures/case-002-huayuankou-adjacency.yaml",
    "specs/golden-cases/case-003-taipingwan.yaml",
    "specs/schema/domain-core-v0.1.yaml",
    "specs/extension-packs/pack-contract-v0.1.yaml",
    "specs/interfaces/domain-services-v0.1.yaml",
    "specs/implementation/case-001-service-test.yaml",
]
RAW_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".rar", ".zip"}


def external(target: str) -> bool:
    return (
        target.startswith(("#", "//"))
        or target.startswith("data:")
        or bool(re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target))
    )


def add_error(label: str) -> None:
    ERRORS.add(label)


def check_exact_sha() -> None:
    try:
        actual = subprocess.check_output(
            ["git", "-C", str(ROOT), "rev-parse", "HEAD"], text=True
        ).strip().lower()
    except Exception:
        add_error("EXACT_SHA_UNAVAILABLE")
        return
    if not re.fullmatch(r"[0-9a-f]{40}", EXPECTED_SHA) or actual != EXPECTED_SHA:
        add_error("EXACT_SHA_MISMATCH")


def check_required_files() -> int:
    missing = sum(1 for relative in REQUIRED_FILES if not (ROOT / relative).is_file())
    if missing:
        add_error("REQUIRED_FILES_MISSING")
    return missing


def check_markdown_links() -> int:
    broken = 0
    for markdown in ROOT.rglob("*.md"):
        if ".git" in markdown.parts:
            continue
        try:
            text = markdown.read_text(encoding="utf-8")
        except Exception:
            add_error("TEXT_READ_ERROR")
            continue
        for raw_target in MARKDOWN_LINK.findall(text):
            target = unquote(raw_target.strip().split(" ")[0].strip("<>"))
            if external(target):
                continue
            relative_target = target.split("#", 1)[0]
            if not relative_target:
                continue
            resolved = (markdown.parent / relative_target).resolve()
            try:
                resolved.relative_to(ROOT)
            except ValueError:
                broken += 1
                continue
            if not resolved.exists():
                broken += 1
    if broken:
        add_error("MARKDOWN_LINK_INVALID")
    return broken


def check_yaml() -> int:
    yaml_files = [
        path for path in ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in {".yaml", ".yml"} and ".git" not in path.parts
    ]
    invalid = 0
    for path in yaml_files:
        try:
            yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception:
            invalid += 1
    if not yaml_files:
        add_error("YAML_FILES_MISSING")
    if invalid:
        add_error("YAML_PARSE_ERROR")
    return len(yaml_files)


def check_raw_materials() -> int:
    found = sum(
        1 for path in ROOT.rglob("*")
        if path.is_file() and ".git" not in path.parts and path.suffix.lower() in RAW_EXTENSIONS
    )
    if found:
        add_error("RAW_MATERIAL_FOUND")
    return found


def check_prototype_resources() -> int:
    broken = 0
    prototype = ROOT / "prototype"
    if not prototype.is_dir():
        return 0
    for html in prototype.glob("*.html"):
        try:
            text = html.read_text(encoding="utf-8")
        except Exception:
            add_error("TEXT_READ_ERROR")
            continue
        for target in HTML_RESOURCE.findall(text):
            target = target.split("#", 1)[0].split("?", 1)[0].strip()
            if not target or external(target):
                continue
            if not (html.parent / target).resolve().exists():
                broken += 1
    if broken:
        add_error("PROTOTYPE_RESOURCE_INVALID")
    return broken


def main() -> int:
    check_exact_sha()
    missing = check_required_files()
    broken_links = check_markdown_links()
    yaml_count = check_yaml()
    raw_count = check_raw_materials()
    broken_resources = check_prototype_resources()

    result = "PASS" if not ERRORS else "FAIL"
    print(f"ATON_CI_RESULT={result}")
    print(f"ATON_CI_EXACT_SHA={EXPECTED_SHA or 'MISSING'}")
    print(f"ATON_CI_REQUIRED_FILES={len(REQUIRED_FILES) - missing}/{len(REQUIRED_FILES)}")
    print(f"ATON_CI_MARKDOWN_LINK_ERRORS={broken_links}")
    print(f"ATON_CI_YAML_FILES={yaml_count}")
    print(f"ATON_CI_RAW_MATERIAL_FILES={raw_count}")
    print(f"ATON_CI_PROTOTYPE_RESOURCE_ERRORS={broken_resources}")
    if ERRORS:
        for label in sorted(ERRORS):
            print(f"ATON_CI_FAILURE={label}")
    return 0 if not ERRORS else 1


if __name__ == "__main__":
    sys.exit(main())
