"""Read-only Inquello spec document checks; JSON to stdout, no runtime claim.

Usage: python .working/check-spec.py [--workspace PATH] [--project-root PATH]
       [--baseline .working/source-baseline.json]
       [--capability-map .working/capability-map.json]

Exit 0: mechanical checks pass; 1: document check failures; 2: setup error.
Uses available PyYAML; never installs packages, fetches URLs or writes files.
Redirect stdout to .working/mechanical-final.json when the draft is ready.
"""
from __future__ import annotations

import argparse
import datetime as dt
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
    print(json.dumps({"status": "error", "error": "Available Python needs PyYAML; nothing was installed.",
                      "runtime_conformance_tested": False}))
    raise SystemExit(2)

MAX_BYTES = 5 * 1024 * 1024
REQUIRED_HEADINGS = ("Why", "Capabilities", "Constraints", "Non-goals", "Success signal")
OPTIONAL_HEADINGS = {"Assumptions", "Open Questions"}
ADOPTED_PATHS = (
    "_bmad-output/planning-artifacts/prds/prd-inquello-2026-10-26/prd.md",
    "_bmad-output/planning-artifacts/prds/prd-inquello-2026-10-26/addendum.md",
    "_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md",
    "_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/EXPERIENCE.md",
    "_bmad-output/planning-artifacts/architecture/architecture-inquello-2026-10-26/ARCHITECTURE-SPINE.md",
    "addendum.md", "PRODUCT_BRIEF_TRACEABILITY.md", "CODEX_AUDITOR_FEATURE_MIRROR.md",
    "CODEX_AUDITOR_FEATURE_MAP.md",
)
LINK = re.compile(r"!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|(?:\\.|[^\s)])+)(?:\s+[\"'][^\n]*?[\"'])?\s*\)")
CAP_DEFINITION = re.compile(r"(?m)^ {0,3}(?:#{3,6}\s+|[-*]\s+)(?:\*\*)?CAP-(\d+)\b[^\n]*$")
FIELD = re.compile(r"(?mi)^\s*(?:[-*]\s+)?(?:\*\*)?(intent|success)(?:\*\*)?\s*:(?:\*\*)?\s*")


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


def bounded_bytes(path):
    if not path.is_file():
        raise ValueError(f"Expected a file: {path}")
    if path.stat().st_size > MAX_BYTES:
        raise ValueError(f"File exceeds bounded read/hash limit ({MAX_BYTES} bytes): {path}")
    return path.read_bytes()


def read_text(path):
    return bounded_bytes(path).decode("utf-8-sig")


def sha256(path):
    return hashlib.sha256(bounded_bytes(path)).hexdigest()


def frontmatter(text):
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", text, re.S)
    if not match:
        raise ValueError("Missing or unterminated YAML frontmatter.")
    data = yaml.load(match.group(1), Loader=UniqueLoader)
    if not isinstance(data, dict):
        raise ValueError("YAML frontmatter must be a mapping.")
    return data, text[match.end():], text[:match.end()].count("\n")


def fence_scan(text):
    clean, blocks, active = [], [], None
    for number, line in enumerate(text.splitlines(), 1):
        if active:
            closing = re.match(r"^ {0,3}(" + re.escape(active["char"]) +
                               "{" + str(active["width"]) + r",})\s*$", line)
            if closing:
                blocks.append(active)
                active = None
            clean.append("")
            continue
        opening = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if opening:
            marker, info = opening.groups()
            active = {"char": marker[0], "width": len(marker), "info": info.strip(), "line": number}
            clean.append("")
        else:
            clean.append(line)
    return "\n".join(clean), blocks, active


def inline_text(text):
    text = re.sub(r"!?\[([^\]]+)\]\([^)]*\)", r"\1", text)
    return html.unescape(re.sub(r"<[^>]+>", "", text).replace("`", "").replace("*", "").strip())


def anchors(text):
    try:
        _, text, _ = frontmatter(text)
    except (ValueError, yaml.YAMLError):
        pass
    scan, _, _ = fence_scan(text)
    titles = [(m.start(), m.group(1)) for m in re.finditer(r"(?m)^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$", scan)]
    titles += [(m.start(), m.group(1)) for m in re.finditer(r"(?m)^([^\n]+)\n {0,3}(?:={3,}|-{3,})\s*$", scan)]
    result, counts = set(), Counter()
    for _, title in sorted(titles):
        slug = re.sub(r"[^\w\- ]", "", inline_text(title).lower(), flags=re.UNICODE).replace(" ", "-")
        count = counts[slug]
        result.add(slug if count == 0 else f"{slug}-{count}")
        counts[slug] += 1
    result.update(re.findall(r"\b(?:id|name)\s*=\s*[\"']([^\"']+)[\"']", scan, re.I))
    return result


def link_targets(text):
    scan, _, _ = fence_scan(text)
    scan = re.sub(r"<!--.*?-->", "", scan, flags=re.S)
    scan = re.sub(r"(`+).*?\1", "", scan)
    targets = [m.group(1).strip("<>") for m in LINK.finditer(scan)]
    definitions = list(re.finditer(r"(?m)^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)", scan))
    targets += [m.group(2).strip("<>") for m in definitions]
    targets += re.findall(r"\b(?:href|src)\s*=\s*[\"']([^\"']+)[\"']", scan, re.I)
    normalize = lambda label: " ".join(label.split()).casefold()
    defined = {normalize(m.group(1)) for m in definitions}
    unresolved = []
    for match in re.finditer(r"!?\[([^\]\n]+)\]\[([^\]\n]*)\]", scan):
        label = normalize(match.group(2) or match.group(1))
        if label not in defined:
            unresolved.append(label)
    return targets, sorted(set(unresolved))


def number(value, prefix):
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, str):
        match = re.fullmatch(re.escape(prefix) + r"-?(\d+)", value)
        if match:
            return int(match.group(1))
    raise ValueError(f"Expected {prefix} identifier, got {value!r}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--project-root", type=Path)
    parser.add_argument("--baseline", type=Path, default=Path(".working/source-baseline.json"))
    parser.add_argument("--capability-map", type=Path, default=Path(".working/capability-map.json"))
    args = parser.parse_args()
    root = args.workspace.resolve()
    if not root.is_dir() or len(root.parents) < 3:
        raise ValueError("Expected an existing spec workspace.")
    project = (args.project_root or root.parents[2]).resolve()
    if not root.is_relative_to(project):
        raise ValueError("Spec workspace must be inside the project root.")
    checks, documents = [], {}
    initial_hashes = {}
    limits = [
        "Capability labels, prose fields and exact FR ownership are mechanical checks; intent WHAT versus HOW, testability, lean prose and semantic preservation need manual review.",
        "Source hashes compare with the supplied baseline; this does not authenticate the initial baseline or prove source authority.",
        "Only SPEC.md and scope-and-gates.md Markdown links are crawled; a target is read only to check a requested fragment. Adopted companions are checked for existence/hash, not recursively crawled.",
        "GitHub-style Markdown heading anchors and ordinary inline/reference links are approximated; uncommon Markdown extensions, shortcut reference syntax and bare ASCII diagrams require manual review.",
        "External URLs are recorded but not fetched. No source, spec, memlog or report file is written; stdout redirection is the caller's choice.",
        "No package installation, imported code execution, technology re-verification, runtime/security/accessibility testing, product acceptance or release validation occurs.",
    ]

    def add(name, passed=True, **details):
        checks.append({"check": name, "status": "pass" if passed else "fail", **details})

    def confined(path):
        path = path.resolve()
        if not path.is_relative_to(project):
            raise ValueError(f"Outside intended project; not inspected: {path}")
        return path

    def record(path, label):
        path = confined(path)
        digest = sha256(path)
        initial_hashes.setdefault(path, digest)
        documents[label] = {"path": str(path), "sha256": digest}
        return read_text(path)

    def local_target(owner, target):
        target = html.unescape(target.strip().strip("<>"))
        if re.match(r"^[A-Za-z]:[\\/]", target):
            file_part, _, fragment = target.partition("#")
        else:
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc:
                return None, None
            file_part, fragment = unquote(parsed.path), unquote(parsed.fragment)
        file_part = re.sub(r"\\([() ])", r"\1", file_part)
        return confined(owner.parent / file_part if file_part else owner), unquote(fragment)

    def check_links(path, text):
        targets, unresolved = link_targets(text)
        missing, bad_anchors, errors, remote, local = [], [], [], [], 0
        for target in targets:
            try:
                resolved, fragment = local_target(path, target)
                if resolved is None:
                    remote.append(target)
                    continue
                local += 1
                if not resolved.exists():
                    missing.append(target)
                elif fragment:
                    if not resolved.is_file() or resolved.suffix.lower() not in {".md", ".markdown", ".html", ".htm", ".svg"}:
                        bad_anchors.append({"target": target, "reason": "fragment format unsupported"})
                    elif fragment not in anchors(read_text(resolved)):
                        bad_anchors.append({"target": target, "reason": "anchor not found"})
            except (OSError, UnicodeError, ValueError) as exc:
                errors.append({"target": target, "error": str(exc)})
        add(f"markdown_links:{path.name}", not (missing or bad_anchors or errors or unresolved),
            local_checked=local, external_not_fetched=remote, missing=missing, bad_anchors=bad_anchors,
            unresolved_reference_labels=unresolved, errors=errors)

    spec_path, authored_path = root / "SPEC.md", root / "scope-and-gates.md"
    text = record(spec_path, "SPEC.md")
    authored = record(authored_path, "scope-and-gates.md")
    data, body, offset = {}, text, 0
    try:
        data, body, offset = frontmatter(text)
        add("yaml_parse_and_unique_keys")
    except (ValueError, yaml.YAMLError) as exc:
        add("yaml_parse_and_unique_keys", False, error=str(exc))
    missing_keys = [key for key in ("id", "companions", "sources") if key not in data]
    invalid = {}
    if data.get("id") != "SPEC-inquello":
        invalid["id"] = "Expected stable id SPEC-inquello"
    for key in ("companions", "sources"):
        if not isinstance(data.get(key), list) or not all(isinstance(item, str) and item.strip() for item in data.get(key, [])):
            invalid[key] = "Expected an array of nonempty relative path strings; sources may be empty"
    add("required_metadata", not missing_keys and not invalid, missing=missing_keys, invalid=invalid,
        empty_sources_legitimate=True)

    expected_adopted = {confined(project / entry) for entry in ADOPTED_PATHS}
    expected_companions = expected_adopted | {authored_path.resolve()}
    found_companions, companion_errors = [], []
    for entry in data.get("companions", []) if isinstance(data.get("companions"), list) else []:
        try:
            if not isinstance(entry, str):
                raise ValueError("Expected a string path")
            parsed = urlsplit(entry)
            parts = Path(entry).parts
            if parsed.scheme or parsed.netloc or Path(entry).is_absolute() or parsed.query or parsed.fragment:
                raise ValueError("Companions must be relative local .md paths without query/fragment")
            if Path(entry).suffix.lower() != ".md":
                raise ValueError("Companion must be a .md file")
            if any(part.lower() in {".working", "reviews"} for part in parts) or Path(entry).name.lower() in {".memlog.md", "stories.yaml", "readme.md"} or Path(entry).name.lower().startswith("review-"):
                raise ValueError("Process metadata/reviews/working files/stories are not companions")
            resolved = confined(root / entry)
            if not resolved.is_file():
                raise ValueError("Companion target is missing or not a file")
            found_companions.append(resolved)
        except (OSError, ValueError) as exc:
            companion_errors.append({"entry": entry, "error": str(exc)})
    duplicates = [str(path) for path, count in Counter(found_companions).items() if count > 1]
    add("companion_contract", not companion_errors and not duplicates and set(found_companions) == expected_companions,
        expected_count=10, expected_authored_count=1, expected_adopted_count=9,
        actual_count=len(found_companions), missing=[str(p) for p in sorted(expected_companions - set(found_companions))],
        unexpected=[str(p) for p in sorted(set(found_companions) - expected_companions)], duplicate_targets=duplicates,
        errors=companion_errors)
    add("all_inputs_remain_companions", data.get("sources") == [], actual_sources=data.get("sources"),
        meaning="This package retains downstream value in all nine adopted inputs; an empty sources array is correct.")

    scan, blocks, unclosed = fence_scan(body)
    headings = list(re.finditer(r"(?m)^ {0,3}##\s+(.+?)\s*#*\s*$", scan))
    titles = [inline_text(m.group(1)) for m in headings]
    sections = {}
    for index, heading in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(scan)
        sections[inline_text(heading.group(1))] = scan[heading.end():end].strip()
    missing_headings = [name for name in REQUIRED_HEADINGS if titles.count(name) != 1]
    required_order = [name for name in titles if name in REQUIRED_HEADINGS]
    unexpected_headings = [name for name in titles if name not in REQUIRED_HEADINGS and name not in OPTIONAL_HEADINGS]
    empty_sections = [name for name in titles if not sections.get(name, "").strip(" \r\n-*")]
    duplicate_headings = [name for name, count in Counter(titles).items() if count > 1]
    add("five_kernel_sections", not missing_headings and required_order == list(REQUIRED_HEADINGS)
        and not unexpected_headings and not empty_sections and not duplicate_headings,
        headings=titles, missing_or_repeated_required=missing_headings, unexpected=unexpected_headings,
        empty=empty_sections, duplicate_headings=duplicate_headings)

    capability_text = sections.get("Capabilities", "")
    definitions = list(CAP_DEFINITION.finditer(capability_text))
    cap_ids = [int(match.group(1)) for match in definitions]
    field_errors, field_counts = [], {}
    for index, definition in enumerate(definitions):
        end = definitions[index + 1].start() if index + 1 < len(definitions) else len(capability_text)
        content = capability_text[definition.end():end]
        fields = list(FIELD.finditer(content))
        seen = Counter(field.group(1).lower() for field in fields)
        field_counts[f"CAP-{definition.group(1)}"] = dict(seen)
        if seen != Counter({"intent": 1, "success": 1}):
            field_errors.append({"id": f"CAP-{definition.group(1)}", "error": "Expected exactly one intent and one success", "counts": dict(seen)})
        for field_index, field in enumerate(fields):
            value_end = fields[field_index + 1].start() if field_index + 1 < len(fields) else len(content)
            value = content[field.end():value_end].strip(" \r\n-*_" )
            if len(re.findall(r"\b[^\W\d_]+\b", value, re.UNICODE)) < 3:
                field_errors.append({"id": f"CAP-{definition.group(1)}", "field": field.group(1).lower(), "error": "Missing or insufficient prose content"})
            if re.search(r"(?m)^\s*(?:#{1,6}\s|[-*]\s|\|)", value):
                field_errors.append({"id": f"CAP-{definition.group(1)}", "field": field.group(1).lower(), "error": "Expected prose, not a nested heading/list/table"})
    cap_duplicates = [f"CAP-{n}" for n, count in Counter(cap_ids).items() if count > 1]
    add("capability_ids_unique_stable", cap_ids == list(range(1, 26)), expected_count=25, actual_count=len(cap_ids),
        ids=[f"CAP-{n}" for n in cap_ids], duplicates=cap_duplicates,
        missing=[f"CAP-{n}" for n in sorted(set(range(1, 26)) - set(cap_ids))],
        unexpected=[f"CAP-{n}" for n in sorted(set(cap_ids) - set(range(1, 26)))])
    add("capability_intent_success_prose", not field_errors and len(definitions) == 25, fields=field_counts,
        errors=field_errors, semantic_what_vs_how_reviewed=False)

    comments = [{"line": text.count("\n", 0, m.start()) + 1, "preview": m.group(0)[:120]}
                for m in re.finditer(r"<!--.*?(?:-->|\Z)", text, re.S)]
    markers = [{"line": text.count("\n", 0, m.start()) + 1, "marker": m.group(0)}
               for m in re.finditer(r"\b(?:TBD|TODO|FIXME|XXX|TEMPLATE GUIDE)\b|\{[^{}\r\n]+\}|\[insert\b[^\]]*\]", text, re.I)]
    template_comments = [line for line in text.splitlines() if re.search(r"#\s*(?:files downstream MUST read|files fully absorbed)", line)]
    add("no_placeholders_or_template_comments", not comments and not markers and not template_comments,
        html_comments=comments, markers=markers, template_comments=template_comments)
    diagram_markers = [{"line": offset + body.count("\n", 0, m.start()) + 1, "marker": m.group(0)[:100]}
                       for m in re.finditer(r"!\[[^\]\n]*\]\(|<(?:svg|canvas|img)\b|(?m:^[ \t]*(?:flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|mindmap)\b)", body, re.I)]
    add("kernel_has_no_diagrams_or_code_blocks", not blocks and unclosed is None and not diagram_markers,
        fenced_blocks=blocks, unclosed_fence=unclosed, diagram_markers=diagram_markers,
        meaning="Prose-only kernel check; bare ASCII diagrams still require manual review.")
    check_links(spec_path, body)
    check_links(authored_path, authored)

    baseline_path = confined(root / args.baseline)
    baseline = json.loads(record(baseline_path, "source_baseline"))
    baseline_entries = baseline.get("sources") if isinstance(baseline, dict) else None
    baseline_errors, baseline_paths, comparisons = [], [], []
    if not isinstance(baseline_entries, list):
        baseline_errors.append({"error": "Baseline requires sources array"})
        baseline_entries = []
    for entry in baseline_entries:
        try:
            if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
                raise ValueError("Baseline entry requires a path string")
            if Path(entry["path"]).is_absolute() or urlsplit(entry["path"]).scheme:
                raise ValueError("Baseline path must be project-relative")
            digest = entry.get("sha256")
            if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", digest):
                raise ValueError("Baseline sha256 must contain 64 hexadecimal digits")
            resolved = confined(project / entry["path"])
            baseline_paths.append(resolved)
            record(resolved, f"adopted:{entry['path']}")
            current = initial_hashes[resolved]
            comparisons.append({"path": entry["path"], "baseline_sha256": digest.lower(), "current_sha256": current, "unchanged": current == digest.lower()})
        except (OSError, UnicodeError, ValueError) as exc:
            baseline_errors.append({"entry": entry, "error": str(exc)})
    baseline_duplicates = [str(path) for path, count in Counter(baseline_paths).items() if count > 1]
    add("nine_source_baseline_unchanged", not baseline_errors and not baseline_duplicates
        and set(baseline_paths) == expected_adopted and len(comparisons) == 9 and all(item["unchanged"] for item in comparisons),
        expected_count=9, comparisons=comparisons, errors=baseline_errors, duplicate_targets=baseline_duplicates,
        missing=[str(p) for p in sorted(expected_adopted - set(baseline_paths))],
        unexpected=[str(p) for p in sorted(set(baseline_paths) - expected_adopted)])

    prd_path = confined(project / ADOPTED_PATHS[0])
    prd = read_text(prd_path)
    fr_definitions = list(re.finditer(r"(?m)^####\s+FR-(\d+)\b([^\n]*)", prd))
    p_definitions = list(re.finditer(r"(?m)^###\s+4\.\d+[^\n]*\bP(\d+)\b", prd))
    source_inventory = {
        "FR": [int(m.group(1)) for m in fr_definitions],
        "NFR": [int(n) for n in re.findall(r"(?m)^-\s+\*\*NFR-(\d+)\b", prd)],
        "P": [int(m.group(1)) for m in p_definitions],
        "UJ": [int(n) for n in re.findall(r"(?m)^-\s+\*\*UJ-(\d+)\b", prd)],
    }
    expected_inventory = {"FR": list(range(1, 45)), "NFR": list(range(1, 11)), "P": list(range(1, 23)), "UJ": list(range(1, 9))}
    source_fr_phase = {int(m.group(1)): ("V2" if re.search(r"\bV2\b", m.group(2)) else "V1") for m in fr_definitions}
    source_fr_p = {}
    for match in fr_definitions:
        prior = [p for p in p_definitions if p.start() < match.start()]
        if prior:
            source_fr_p[int(match.group(1))] = int(prior[-1].group(1))
    source_phase_counts = Counter(source_fr_phase.values())
    add("actual_prd_inventory", source_inventory == expected_inventory and source_phase_counts == Counter({"V1": 41, "V2": 3}),
        counts={key: len(value) for key, value in source_inventory.items()},
        expected_counts={key: len(value) for key, value in expected_inventory.items()},
        phase_counts=dict(source_phase_counts), duplicate_ids={key: [n for n, count in Counter(value).items() if count > 1] for key, value in source_inventory.items()},
        V2_FRs=[f"FR-{n}" for n, phase in source_fr_phase.items() if phase == "V2"])

    map_path = confined(root / args.capability_map)
    raw_map = json.loads(record(map_path, "capability_map"))
    entries = raw_map.get("capabilities") if isinstance(raw_map, dict) else raw_map
    map_errors, normalized = [], []
    if not isinstance(entries, list):
        map_errors.append({"error": "Capability map must be an array or an object with capabilities array"})
        entries = []
    for entry in entries:
        try:
            if not isinstance(entry, dict) or not all(key in entry for key in ("id", "phase", "p", "fr")):
                raise ValueError("Each capability needs id, phase, p and fr fields")
            cap, group = number(entry["id"], "CAP"), number(entry["p"], "P")
            if entry["phase"] not in {"V1", "V2"}:
                raise ValueError("Phase must be V1 or V2")
            if not isinstance(entry["fr"], list) or not entry["fr"]:
                raise ValueError("fr must be a nonempty array")
            normalized.append({"id": cap, "phase": entry["phase"], "p": group,
                               "fr": [number(value, "FR") for value in entry["fr"]]})
        except (TypeError, ValueError) as exc:
            map_errors.append({"entry": entry, "error": str(exc)})
    map_ids = [entry["id"] for entry in normalized]
    owners = {}
    for entry in normalized:
        for fr in entry["fr"]:
            owners.setdefault(fr, []).append(entry)
    duplicate_fr = {f"FR-{fr}": [f"CAP-{entry['id']}" for entry in assigned] for fr, assigned in owners.items() if len(assigned) != 1}
    phase_counts = Counter(entry["phase"] for entry in normalized for _ in entry["fr"])
    mismatches = []
    for entry in normalized:
        cap = entry["id"]
        expected_group = cap if 1 <= cap <= 22 else {23: 19, 24: 20, 25: 21}.get(cap)
        expected_phase = "V1" if 1 <= cap <= 22 else "V2"
        wanted_fr = {fr for fr, group in source_fr_p.items() if group == expected_group and source_fr_phase[fr] == expected_phase}
        if entry["p"] != expected_group or entry["phase"] != expected_phase or set(entry["fr"]) != wanted_fr:
            mismatches.append({"id": f"CAP-{cap}", "expected_p": f"P{expected_group:02d}" if expected_group else None,
                               "expected_phase": expected_phase, "expected_fr": sorted(wanted_fr), "actual": entry})
    add("capability_map_shape_and_ids", not map_errors and sorted(map_ids) == list(range(1, 26)) and set(map_ids) == set(cap_ids),
        errors=map_errors, map_count=len(normalized), duplicate_ids=[f"CAP-{n}" for n, count in Counter(map_ids).items() if count > 1])
    add("fr_exactly_once_and_phase_coverage", not duplicate_fr and set(owners) == set(range(1, 45))
        and phase_counts == Counter({"V1": 41, "V2": 3}),
        FR_count=len(owners), phase_counts=dict(phase_counts), duplicates=duplicate_fr,
        missing=[f"FR-{n}" for n in sorted(set(range(1, 45)) - set(owners))],
        unexpected=[f"FR-{n}" for n in sorted(set(owners) - set(range(1, 45)))])
    groups = {entry["p"] for entry in normalized}
    add("capability_to_prd_group_and_phase_mapping", not mismatches and groups == set(range(1, 23)),
        represented_P_count=len(groups), mismatches=mismatches,
        meaning="CAP-1–22 own V1 portions of P01–P22; CAP-23/24/25 own FR-38/40/42 in P19/20/21 respectively. This proves mapping, not semantic coverage.")

    changed, recheck_errors = [], []
    for path, initial in initial_hashes.items():
        try:
            final = sha256(path)
            if final != initial:
                changed.append({"path": str(path), "initial_sha256": initial, "final_sha256": final})
        except (OSError, ValueError) as exc:
            recheck_errors.append({"path": str(path), "error": str(exc)})
    add("inspected_inputs_unchanged_during_check", not changed and not recheck_errors,
        file_count=len(initial_hashes), changed=changed, errors=recheck_errors)
    failures = sum(item["status"] == "fail" for item in checks)
    print(json.dumps({"status": "fail" if failures else "pass", "checked_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                      "workspace": str(root), "check_type": "read-only-spec-document-check",
                      "runtime_conformance_tested": False, "semantic_preservation_validated": False,
                      "manual_review_required": ["Capability intent WHAT versus HOW", "Capability success testability",
                                                 "Constraint relevance and non-goals", "Load-bearing source preservation",
                                                 "Lean prose and unrecognized diagram syntax"],
                      "external_urls_fetched": False, "imported_code_executed": False,
                      "documents": documents,
                      "summary": {"checks": len(checks), "passed": len(checks) - failures, "failed": failures},
                      "checks": checks, "limits": limits}, indent=2, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        raise SystemExit(main())
    except (OSError, UnicodeError, ValueError, yaml.YAMLError) as exc:
        print(json.dumps({"status": "error", "error": str(exc), "runtime_conformance_tested": False}, ensure_ascii=False))
        raise SystemExit(2)
