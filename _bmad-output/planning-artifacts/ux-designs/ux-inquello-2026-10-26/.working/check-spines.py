"""Read-only mechanical coverage checks for the Inquello UX spine pair.

Usage: uv run python .working/check-spines.py [--coverage relative/path.md]
JSON goes to stdout. Exit 0 = pass, 1 = document failures, 2 = setup error.
Does not execute imported code, fetch URLs, or assess runtime conformance.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit

try:
    import yaml
except ImportError:
    print(json.dumps({"status": "error", "error": "PyYAML is required; run with the available uv Python environment."}))
    raise SystemExit(2)


DESIGN_H2 = ["Brand & Style", "Colors", "Typography", "Layout & Spacing",
             "Elevation & Depth", "Shapes", "Components", "Do's and Don'ts"]
EXPERIENCE_H2 = ["Foundation", "Information Architecture", "Voice and Tone",
                 "Component Patterns", "State Patterns", "Interaction Primitives",
                 "Accessibility Floor", "Key Flows"]
COMPONENTS = {
    "Icon", "Button", "IconButton", "Avatar", "Badge", "TextField", "Switch",
    "Choice", "SegmentedControl", "Tabs", "Menu", "StatusChip", "JudgmentTag",
    "FileChip", "PlanStep", "ApprovalCard", "DiffLine", "Toast", "Sidebar",
    "Header", "Composer", "NavRow", "Over", "Workbook", "StartScreen",
    "ActiveScreen", "ReviewScreen", "AutomationsScreen",
}
TOKEN = re.compile(r"\{((?:colors|typography|rounded|spacing|components)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)\}")
HEX = re.compile(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\Z")
LINK = re.compile(r"!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+[\"'][^\n]*?[\"'])?\s*\)")


class UniqueLoader(yaml.SafeLoader):
    pass


def unique_mapping(loader, node, deep=False):
    loader.flatten_mapping(node)
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        try:
            duplicate = key in result
        except TypeError:
            raise yaml.constructor.ConstructorError("mapping", node.start_mark,
                                                    "unhashable YAML key", key_node.start_mark)
        if duplicate:
            raise yaml.constructor.ConstructorError("mapping", node.start_mark,
                                                    f"duplicate YAML key: {key!r}", key_node.start_mark)
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


def strip_fences(text):
    """Preserve line positions while excluding fenced code from Markdown analysis."""
    output, fence = [], None
    for line in text.splitlines():
        marker = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
        if marker:
            value = marker.group(1)
            if fence is None:
                fence = value
            elif value[0] == fence[0] and len(value) >= len(fence):
                fence = None
            output.append("")
        else:
            output.append("" if fence else line)
    return "\n".join(output)


def clean_inline(text):
    text = re.sub(r"!?\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text.replace("`", "").replace("**", "").strip())


def headings(text):
    return [(len(m.group(1)), clean_inline(m.group(2).rstrip("# ")))
            for m in re.finditer(r"(?m)^ {0,3}(#{1,6})\s+(.+)$", strip_fences(text))]


def normal_heading(text):
    return text.replace("’", "'").replace("‘", "'")


def anchors(text):
    counts, result = Counter(), set()
    for _, title in headings(text):
        slug = re.sub(r"[^\w\- ]", "", title.lower(), flags=re.UNICODE).replace(" ", "-")
        suffix = counts[slug]
        result.add(slug if suffix == 0 else f"{slug}-{suffix}")
        counts[slug] += 1
    result.update(re.findall(r"\b(?:id|name)\s*=\s*[\"']([^\"']+)[\"']", text, re.I))
    return result


def links(text):
    text = strip_fences(text)
    targets = [m.group(1).strip("<>") for m in LINK.finditer(text)]
    targets += [m.group(1).strip("<>") for m in re.finditer(r"(?m)^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)", text)]
    targets += re.findall(r"\b(?:href|src)\s*=\s*[\"']([^\"']+)[\"']", text, re.I)
    return targets


def source_entries(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for entry in value for item in source_entries(entry)]
    if isinstance(value, dict):
        named = [value[key] for key in ("path", "file", "url", "href", "reference") if key in value]
        return [item for entry in (named or list(value.values())) for item in source_entries(entry)]
    return []


def section_table_names(body, heading):
    active, rows = False, []
    for line in strip_fences(body).splitlines():
        h2 = re.match(r"^##\s+(.+)$", line)
        if h2:
            active = normal_heading(clean_inline(h2.group(1))) == heading
            continue
        if not active or not line.lstrip().startswith("|"):
            continue
        first = clean_inline(line.strip().strip("|").split("|", 1)[0]).strip()
        if not first or re.fullmatch(r"[-: ]+", first) or first.lower() in {"component", "name", "component name"}:
            continue
        rows.append(first)
    return rows


def resolve_token(data, path):
    value = data
    for part in path.split("."):
        if not isinstance(value, dict):
            return False
        matching = [key for key in value if str(key) == part]
        if len(matching) != 1:
            return False
        value = value[matching[0]]
    return True


def id_references(text, prefix):
    found = {int(n) for n in re.findall(rf"\b{prefix}-(\d+)\b", text)}
    for match in re.finditer(rf"\b{prefix}-(\d+)\s*[-–—]\s*(?:{prefix}-)?(\d+)\b", text):
        start, end = map(int, match.groups())
        if start <= end and end - start <= 1000:
            found.update(range(start, end + 1))
    for match in re.finditer(rf"\b{prefix}-(\d+)((?:\s*/\s*(?:{prefix}-)?\d+)+)", text):
        found.add(int(match.group(1)))
        found.update(map(int, re.findall(r"\d+", match.group(2))))
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--coverage", type=Path, action="append", default=[], help="Explicit coverage Markdown/JSON; repeatable; relative to workspace.")
    args = parser.parse_args()
    root = args.workspace.resolve()
    if len(root.parents) < 4 or not root.is_dir():
        raise ValueError("Expected an existing project UX run folder.")
    project = root.parents[3]
    checks, documents = [], {}

    def add(name, passed, **details):
        checks.append({"check": name, "status": "pass" if passed else "fail", **details})

    def confined(path):
        resolved = path.resolve()
        try:
            resolved.relative_to(project)
        except ValueError:
            raise ValueError(f"Referenced path is outside project; not inspected: {path}")
        return resolved

    def local_target(owner, target):
        target = html.unescape(target.strip().strip("<>"))
        if re.match(r"^[A-Za-z]:[\\/]", target):
            file_part, _, fragment = target.partition("#")
        else:
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc:
                return None, None
            file_part, fragment = unquote(parsed.path), unquote(parsed.fragment)
        path = owner.parent / file_part if file_part else owner
        return confined(path), fragment

    def check_links(owner, text, label):
        missing, bad_fragments, errors, checked, remote = [], [], [], 0, 0
        for target in links(text):
            try:
                path, fragment = local_target(owner, target)
                if path is None:
                    remote += 1
                    continue
                checked += 1
                if not path.exists():
                    missing.append(target)
                elif fragment:
                    if path.suffix.lower() not in {".md", ".markdown", ".html", ".htm", ".svg"}:
                        bad_fragments.append({"target": target, "reason": "fragment target format cannot be validated"})
                    elif fragment not in anchors(path.read_text(encoding="utf-8-sig")):
                        bad_fragments.append({"target": target, "reason": "anchor not found"})
            except (OSError, UnicodeError, ValueError) as exc:
                errors.append({"target": target, "error": str(exc)})
        add(label, not (missing or bad_fragments or errors), local_links_checked=checked,
            external_links_not_fetched=remote, missing_targets=missing, invalid_fragments=bad_fragments, errors=errors)

    for name in ("DESIGN.md", "EXPERIENCE.md"):
        path = root / name
        try:
            text = path.read_text(encoding="utf-8-sig")
            match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", text, re.S)
            if not match:
                raise ValueError("Missing or unterminated YAML frontmatter.")
            data = yaml.load(match.group(1), Loader=UniqueLoader)
            if not isinstance(data, dict):
                raise ValueError("YAML frontmatter must be a mapping.")
            documents[name] = {"path": path, "text": text, "body": text[match.end():], "data": data,
                               "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            add(f"{name}.yaml", True, duplicate_keys=False)
        except (OSError, UnicodeError, ValueError, yaml.YAMLError) as exc:
            add(f"{name}.yaml", False, error=str(exc))
            continue
        entries = source_entries(data.get("sources"))
        missing, source_errors = [], []
        for entry in entries:
            try:
                target, fragment = local_target(path, entry)
                if target is not None and not target.exists():
                    missing.append(entry)
                elif target is not None and fragment:
                    if target.suffix.lower() not in {".md", ".markdown", ".html", ".htm", ".svg"}:
                        source_errors.append({"source": entry, "error": "fragment format cannot be validated"})
                    elif fragment not in anchors(target.read_text(encoding="utf-8-sig")):
                        source_errors.append({"source": entry, "error": "source fragment not found"})
            except (ValueError, OSError) as exc:
                source_errors.append({"source": entry, "error": str(exc)})
        add(f"{name}.sources", bool(entries) and not (missing or source_errors), source_count=len(entries),
            missing_targets=missing, errors=source_errors)
        check_links(path, documents[name]["body"], f"{name}.links")

    design = documents.get("DESIGN.md")
    experience = documents.get("EXPERIENCE.md")
    if design:
        data = design["data"]
        colors = data.get("colors")
        bad_colors = {str(k): repr(v) for k, v in colors.items() if not isinstance(v, str) or not HEX.fullmatch(v)} if isinstance(colors, dict) else {"colors": "missing/non-mapping"}
        add("design.colors_flat_hex", isinstance(colors, dict) and bool(colors) and not bad_colors,
            color_count=len(colors) if isinstance(colors, dict) else 0, invalid=bad_colors)
        for namespace in ("typography", "rounded", "spacing", "components"):
            add(f"design.{namespace}_mapping", isinstance(data.get(namespace), dict) and bool(data[namespace]))
        h2 = [normal_heading(title) for level, title in headings(design["body"]) if level == 2]
        unknown = [title for title in h2 if title not in DESIGN_H2]
        present = [title for title in h2 if title in DESIGN_H2]
        expected = [title for title in DESIGN_H2 if title in present]
        add("design.canonical_h2_order", not unknown and present == expected, present=h2, unknown=unknown,
            expected_order=DESIGN_H2, sections_may_be_omitted=True)
        for name, doc in documents.items():
            refs = list(TOKEN.finditer(doc["text"]))
            unresolved = [{"token": m.group(1), "line": doc["text"].count("\n", 0, m.start()) + 1}
                          for m in refs if not resolve_token(data, m.group(1))]
            add(f"{name}.token_references", not unresolved, references_checked=len(refs),
                namespaces=["colors", "typography", "rounded", "spacing", "components"], unresolved=unresolved)
    if experience:
        h2 = [normal_heading(title) for level, title in headings(experience["body"]) if level == 2]
        absent = [title for title in EXPERIENCE_H2 if title not in h2]
        duplicate = [name for name, count in Counter(h2).items() if count > 1]
        add("experience.required_h2", not absent and not duplicate, missing=absent, duplicate=duplicate, present=h2)
    if design and experience:
        drows = section_table_names(design["body"], "Components")
        erows = section_table_names(experience["body"], "Component Patterns")
        dset, eset = set(drows), set(erows)
        duplicate = {name: [c for c, n in Counter(rows).items() if n > 1]
                     for name, rows in (("DESIGN", drows), ("EXPERIENCE", erows))}
        add("components.paired_table_names", dset == eset == COMPONENTS and not any(duplicate.values()),
            expected_count=len(COMPONENTS), design_count=len(dset), experience_count=len(eset),
            design_missing=sorted(COMPONENTS - dset), experience_missing=sorted(COMPONENTS - eset),
            design_extra=sorted(dset - COMPONENTS), experience_extra=sorted(eset - COMPONENTS), duplicates=duplicate)
        token_names = set(design["data"].get("components", {}))
        add("components.frontmatter_names", token_names == COMPONENTS,
            missing=sorted(COMPONENTS - token_names), extra=sorted(map(str, token_names - COMPONENTS)))

    coverage_paths = set()
    for folder in (root, root / ".working"):
        if folder.is_dir():
            coverage_paths.update(p.resolve() for p in folder.iterdir()
                                  if p.is_file() and "coverage" in p.name.lower() and p.suffix.lower() in {".md", ".json"})
    coverage_paths.update(confined(root / path) for path in args.coverage)
    coverage_text = "\n".join(doc["body"] for doc in documents.values())
    coverage_errors, coverage_names = [], []
    for path in sorted(coverage_paths):
        try:
            text = confined(path).read_text(encoding="utf-8-sig")
            if path.suffix.lower() == ".json":
                json.loads(text)
            else:
                check_links(path, text, f"coverage_links:{path.relative_to(root).as_posix()}")
            coverage_text += "\n" + text
            coverage_names.append(path.relative_to(root).as_posix())
        except (OSError, UnicodeError, ValueError) as exc:
            coverage_errors.append({"path": str(path), "error": str(exc)})
    add("coverage.artifacts_read", not coverage_errors, artifacts=coverage_names, errors=coverage_errors)
    for prefix, maximum in (("UJ", 8), ("FR", 44)):
        found = id_references(coverage_text, prefix)
        expected = set(range(1, maximum + 1))
        add(f"coverage.{prefix}_references", expected.issubset(found) and not (found - expected),
            expected_count=maximum, referenced_count=len(found), missing=[f"{prefix}-{n}" for n in sorted(expected - found)],
            unexpected=[f"{prefix}-{n}" for n in sorted(found - expected)],
            meaning="ID mentions including ranges/slash lists; not semantic requirement or flow completeness.")

    manifest = root / "imports/IMPORT-MANIFEST.md"
    import_root = root / "imports/inquello-design-system"
    try:
        manifest_text = manifest.read_text(encoding="utf-8-sig")
        check_links(manifest, manifest_text, "imports.manifest_links")
        listed = []
        for target in links(manifest_text):
            path, _ = local_target(manifest, target)
            if path is not None:
                try:
                    listed.append(path.relative_to(import_root.resolve()).as_posix())
                except ValueError:
                    pass
        actual = {path.relative_to(import_root).as_posix() for path in import_root.rglob("*") if path.is_file()}
        duplicate = [name for name, count in Counter(listed).items() if count > 1]
        add("imports.all_158_accounted", len(actual) == 158 and set(listed) == actual and not duplicate,
            expected_file_count=158, actual_file_count=len(actual), manifest_entry_count=len(listed),
            unlisted=sorted(actual - set(listed)), extra=sorted(set(listed) - actual), duplicate=sorted(duplicate))
    except (OSError, UnicodeError, ValueError) as exc:
        add("imports.all_158_accounted", False, error=str(exc))

    failures = sum(check["status"] == "fail" for check in checks)
    report = {
        "status": "pass" if not failures else "fail", "workspace": str(root),
        "check_type": "mechanical-document-coverage", "runtime_conformance_tested": False,
        "imported_code_executed": False, "optional_reviewers_run_by_this_check": False,
        "separate_review_reports": sorted(path.name for path in root.glob("review-*.md")),
        "documents": {name: {"sha256": doc["sha256"]} for name, doc in documents.items()},
        "summary": {"checks": len(checks), "passed": len(checks) - failures, "failed": failures},
        "checks": checks,
        "limits": ["Does not assess UI behavior, visual rendering, accessibility conformance, contrast, or semantic completeness.",
                   "External links are recorded but not fetched. Token-like placeholders outside the five namespaces are ignored.",
                   "Imported inventory coverage does not repeat the archive byte-integrity comparison."],
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False))
        raise SystemExit(2)
