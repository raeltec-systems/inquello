"""Read-only architecture document checks; no review or runtime conformance claim.

Usage: uv run python .working/check-architecture.py [--coverage relative/file.md]
Default input: ../ARCHITECTURE-SPINE.md relative to this script.
JSON to stdout; exit 0 pass, 1 actual check failures, 2 setup failure.
Requires the already available PyYAML. Does not install packages or fetch URLs.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit

MAX_BYTES = 5 * 1024 * 1024
SPINE = "ARCHITECTURE-SPINE.md"
REQUIRED = ("name", "type", "purpose", "altitude", "paradigm", "scope", "status",
            "created", "updated", "binds", "sources", "companions")
LINK = re.compile(r"!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|(?:\\.|[^\s)])+)(?:\s+[\"'][^\n]*?[\"'])?\s*\)")
AD_HEADING = re.compile(r"(?m)^ {0,3}#{1,6}\s+AD-(\d+)\b[^\n]*$")

try:
    import yaml
except ImportError:
    print(json.dumps({"status": "error", "error": "PyYAML is required in the available Python environment; nothing was installed."}))
    raise SystemExit(2)


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


def read_text(path):
    if path.stat().st_size > MAX_BYTES:
        raise ValueError(f"File exceeds bounded read limit ({MAX_BYTES} bytes): {path}")
    return path.read_text(encoding="utf-8-sig")


def sha256(path):
    if path.stat().st_size > MAX_BYTES:
        raise ValueError(f"File exceeds hash/read limit: {path}")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frontmatter(text):
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", text, re.S)
    if not match:
        raise ValueError("Missing or unterminated YAML frontmatter.")
    data = yaml.load(match.group(1), Loader=UniqueLoader)
    if not isinstance(data, dict):
        raise ValueError("YAML frontmatter must be a mapping.")
    return data, text[match.end():], text[:match.end()].count("\n")


def fence_scan(text):
    """Return unfenced text with stable line numbers, blocks and unclosed fences."""
    clean, blocks, active = [], [], None
    for number, line in enumerate(text.splitlines(), 1):
        if active:
            closing = re.match(r"^ {0,3}(" + re.escape(active["char"]) +
                               "{" + str(active["width"]) + r",})\s*$", line)
            if closing:
                blocks.append(active)
                active = None
            else:
                active["content"].append(line)
            clean.append("")
            continue
        opening = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", line)
        if opening:
            marker, info = opening.groups()
            active = {"char": marker[0], "width": len(marker), "info": info.strip(),
                      "line": number, "content": []}
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
    result, counts = set(), Counter()
    for match in re.finditer(r"(?m)^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$", scan):
        title = inline_text(match.group(1))
        slug = re.sub(r"[^\w\- ]", "", title.lower(), flags=re.UNICODE).replace(" ", "-")
        count = counts[slug]
        result.add(slug if count == 0 else f"{slug}-{count}")
        counts[slug] += 1
    result.update(re.findall(r"\b(?:id|name)\s*=\s*[\"']([^\"']+)[\"']", scan, re.I))
    return result


def link_targets(text):
    scan, _, _ = fence_scan(text)
    scan = re.sub(r"<!--.*?-->", "", scan, flags=re.S)
    # Inline code is literal text, not a link definition.
    scan = re.sub(r"(`+).*?\1", "", scan)
    targets = [m.group(1).strip("<>") for m in LINK.finditer(scan)]
    targets += [m.group(1).strip("<>") for m in re.finditer(r"(?m)^ {0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)", scan)]
    targets += re.findall(r"\b(?:href|src)\s*=\s*[\"']([^\"']+)[\"']", scan, re.I)
    return targets


def source_entries(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [entry for item in value for entry in source_entries(item)]
    if isinstance(value, dict):
        named = [value[key] for key in ("path", "file", "url", "href", "reference") if key in value]
        if not named:
            raise ValueError("Structured source/companion entry needs path, file, url, href or reference.")
        return [entry for item in named for entry in source_entries(item)]
    raise ValueError("Source/companion entries must be paths/URLs or structured references.")


def id_references(text, prefix):
    """Recognize FR-1–FR-4, FR-1–4, FR-1/2/3 and P01–P22 forms."""
    stem = re.escape(prefix) + (r"-?" if prefix == "P" else "-")
    start = rf"(?<![\w-]){stem}"
    found = {int(n) for n in re.findall(start + r"(\d+)\b", text)}
    for match in re.finditer(start + rf"(\d+)\s*(?:–|—|-|\.\.|\bto\b)\s*(?:{stem})?(\d+)\b", text):
        first, last = map(int, match.groups())
        if first <= last and last - first <= 1000:
            found.update(range(first, last + 1))
    for match in re.finditer(start + rf"(\d+)((?:\s*/\s*(?:{stem})?\d+)+)", text):
        found.add(int(match.group(1)))
        found.update(map(int, re.findall(r"\d+", match.group(2))))
    return found


def is_date(value):
    if isinstance(value, (dt.date, dt.datetime)):
        return True
    if isinstance(value, str):
        try:
            dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
            return bool(re.match(r"^\d{4}-\d{2}-\d{2}(?:$|[T ])", value))
        except ValueError:
            return False
    return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--project-root", type=Path)
    parser.add_argument("--source-prd", type=Path, help="Default: final Inquello PRD; a relative override resolves from project root.")
    parser.add_argument("--coverage", type=Path, action="append", default=[], help="Explicit supplemental coverage file, relative to workspace; repeatable.")
    args = parser.parse_args()
    root = args.workspace.resolve()
    if not root.is_dir() or len(root.parents) < 4:
        raise ValueError("Expected an existing architecture run directory.")
    project = (args.project_root or root.parents[3]).resolve()
    lint_path = project / ".agents/skills/bmad-architecture/scripts/lint_spine.py"
    source_path = project / (args.source_prd or Path("_bmad-output/planning-artifacts/prds/prd-inquello-2026-10-26/prd.md"))
    path = root / SPINE
    checks, documents, limits = [], {}, [
        "Presence of FR/NFR/P identifiers, including ranges, is not semantic requirement coverage.",
        "AD field/ordering checks use the supplied linter plus a complete heading scan; enforceability and architecture quality are not assessed.",
        "Mermaid checks only confirm fenced blocks contain content beyond a declaration/comments. No Mermaid parser or renderer is used.",
        "Markdown links and GitHub-style heading anchors are checked mechanically; uncommon Markdown extensions may require manual verification.",
        "External URLs are recorded but not fetched. No transitive source-document crawl, imported code execution or package installation occurs.",
        "Does not verify technology versions, runtime compatibility, security, accessibility, product conformance or decision authorization.",
    ]

    def add(name, passed=True, status=None, **details):
        checks.append({"check": name, "status": status or ("pass" if passed else "fail"), **details})

    def confined(target):
        target = target.resolve()
        if not target.is_relative_to(project):
            raise ValueError(f"Outside intended project; not inspected: {target}")
        return target

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
        return confined(owner.parent / file_part if file_part else owner), fragment

    def check_targets(owner, targets, label):
        missing, bad_anchors, errors, remote, local = [], [], [], [], 0
        for target in targets:
            try:
                resolved, fragment = local_target(owner, target)
                if resolved is None:
                    remote.append(target)
                    continue
                local += 1
                if not resolved.exists():
                    missing.append(target)
                elif fragment:
                    if not resolved.is_file() or resolved.suffix.lower() not in {".md", ".markdown", ".html", ".htm", ".svg"}:
                        bad_anchors.append({"target": target, "reason": "fragment format unsupported by this checker"})
                    elif fragment not in anchors(read_text(resolved)):
                        bad_anchors.append({"target": target, "reason": "anchor not found"})
            except (OSError, UnicodeError, ValueError) as exc:
                errors.append({"target": target, "error": str(exc)})
        add(label, not (missing or bad_anchors or errors), local_checked=local,
            external_not_fetched=remote, missing=missing, bad_anchors=bad_anchors, errors=errors)

    text = read_text(confined(path))
    documents[SPINE] = {"path": str(path), "sha256": sha256(path)}
    data, body, offset = {}, text, 0
    try:
        data, body, offset = frontmatter(text)
        add("yaml_parse_and_unique_keys", duplicate_keys=False)
    except (ValueError, yaml.YAMLError) as exc:
        add("yaml_parse_and_unique_keys", False, error=str(exc))

    missing = [key for key in REQUIRED if key not in data]
    invalid = {}
    for key in ("name", "paradigm", "scope"):
        if key in data and (not isinstance(data[key], str) or not data[key].strip()):
            invalid[key] = "expected a nonempty string"
    enums = {"type": {"architecture-spine"}, "purpose": {"build-substrate", "discussion", "report", "deck"},
             "altitude": {"initiative", "feature", "epic"}, "status": {"draft", "final"}}
    for key, allowed in enums.items():
        if key in data and (not isinstance(data[key], str) or data[key] not in allowed):
            invalid[key] = f"expected one of {sorted(allowed)}"
    for key in ("created", "updated"):
        if key in data and not is_date(data[key]):
            invalid[key] = "expected an ISO date or datetime"
    for key in ("binds", "sources", "companions"):
        if key in data and not isinstance(data[key], list):
            invalid[key] = "expected a list (companions and binds may be empty)"
    if "sources" in data and isinstance(data["sources"], list) and not data["sources"]:
        invalid["sources"] = "expected at least one governing source for this PRD-driven run"
    add("required_metadata", not missing and not invalid, required=list(REQUIRED), missing=missing, invalid=invalid)
    for key in ("sources", "companions"):
        try:
            entries = source_entries(data.get(key, []))
            check_targets(path, entries, f"frontmatter_{key}_targets")
        except ValueError as exc:
            add(f"frontmatter_{key}_targets", False, error=str(exc))
    check_targets(path, link_targets(body), "markdown_targets_and_anchors")

    lint_path = confined(lint_path)
    documents["upstream_linter"] = {"path": str(lint_path), "sha256": sha256(lint_path)}
    run = subprocess.run([sys.executable, str(lint_path), "--workspace", str(root)],
                         capture_output=True, text=True, encoding="utf-8", timeout=30, check=False)
    lint_result = json.loads(run.stdout)
    # The supplied script exits zero even for findings. Inspect the JSON, not that exit code.
    uncertain = [finding for finding in lint_result.get("findings", [])
                 if finding.get("category") == "placeholder" and finding.get("severity") == "low"]
    actual = [finding for finding in lint_result.get("findings", []) if finding not in uncertain]
    add("supplied_lint_spine", run.returncode == 0 and not lint_result.get("error") and not actual,
        process_exit=run.returncode, result=lint_result, actual_failures=actual,
        possible_brace_tokens_for_manual_check=uncertain)
    if uncertain:
        add("possible_brace_tokens", status="warn", findings=uncertain,
            meaning="The supplied linter marks these as possible placeholders; not automatically an actual failure.")

    scan, blocks, unclosed = fence_scan(body)
    add("closed_code_fences", unclosed is None,
        unclosed_line=(unclosed["line"] + offset) if unclosed else None)
    definitions = [(int(m.group(1)), offset + scan.count("\n", 0, m.start()) + 1) for m in AD_HEADING.finditer(scan)]
    ids = [num for num, _ in definitions]
    duplicates = sorted(num for num, count in Counter(ids).items() if count > 1)
    add("all_ad_headings_unique_ascending", bool(ids) and not duplicates and all(a < b for a, b in zip(ids, ids[1:])),
        definitions=[{"id": f"AD-{num}", "line": line} for num, line in definitions], duplicate_ids=duplicates)
    # The upstream linter checks presence of the words; also reject empty labelled fields.
    field_errors = []
    for heading in AD_HEADING.finditer(scan):
        following = re.search(r"(?m)^ {0,3}#{1,6}\s", scan[heading.end():])
        end = heading.end() + following.start() if following else len(scan)
        block = scan[heading.end():end]
        fields = list(re.finditer(r"(?mi)^\s*(?:[-*]\s+)?(?:\*\*)?(Binds|Prevents|Rule)(?:\*\*)?\s*:(?:\*\*)?\s*", block))
        seen_fields = {}
        for index, field in enumerate(fields):
            value_end = fields[index + 1].start() if index + 1 < len(fields) else len(block)
            seen_fields[field.group(1).lower()] = bool(block[field.end():value_end].strip(" \t\r\n*-_"))
        missing_or_empty = [name for name in ("binds", "prevents", "rule") if not seen_fields.get(name)]
        if missing_or_empty:
            field_errors.append({"id": f"AD-{heading.group(1)}", "missing_or_empty": missing_or_empty})
    add("ad_labelled_fields_nonempty", not field_errors, errors=field_errors,
        meaning="Mechanical labelled content check; no semantic judgment about enforceability.")
    reference_scan = body
    # A labelled AD link to another file is resolved by the link checker, not as a local AD.
    for match in list(LINK.finditer(body)):
        target = match.group(1).strip("<>")
        try:
            resolved, _ = local_target(path, target)
            if resolved != path.resolve():
                reference_scan = reference_scan.replace(match.group(0), "")
        except ValueError:
            pass
    references = id_references(reference_scan, "AD")
    dangling = sorted(references - set(ids))
    add("ad_crossreferences", not dangling, referenced_ids=[f"AD-{n}" for n in sorted(references)],
        unresolved=[f"AD-{n}" for n in dangling])

    comments = [{"line": offset + scan.count("\n", 0, m.start()) + 1, "preview": m.group(0)[:160]}
                for m in re.finditer(r"<!--.*?(?:-->|\Z)", scan, re.S)]
    markers = [{"line": text.count("\n", 0, m.start()) + 1, "marker": m.group(0)}
               for m in re.finditer(r"\b(?:TBD|TODO|FIXME|XXX|TEMPLATE GUIDE)\b", text)]
    template_text = read_text(confined(project / ".agents/skills/bmad-architecture/assets/spine-template.md"))
    template_tokens = set(re.findall(r"\{[^{}\r\n]+\}", template_text))
    residual = sorted(token for token in template_tokens if token in text)
    add("no_template_comments_or_markers", not comments and not markers and not residual,
        html_comments=comments, markers=markers, literal_template_tokens=residual)

    diagrams, empty = [], []
    for block in blocks:
        if block["info"].lower().split(maxsplit=1)[0:1] != ["mermaid"]:
            continue
        raw = "\n".join(block["content"])
        substantive = re.sub(r"(?m)%%.*$", "", raw).strip()
        substantive = re.sub(r"\A\s*(?:flowchart|graph)\s+(?:TB|TD|BT|RL|LR)\s*;?", "", substantive)
        substantive = re.sub(r"\A\s*(?:sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context|C4Container|block-beta|architecture-beta|xychart-beta)\s*;?", "", substantive)
        item = {"line": block["line"] + offset, "nonempty_after_declaration": bool(substantive.strip())}
        diagrams.append(item)
        if not item["nonempty_after_declaration"]:
            empty.append(item["line"])
    add("mermaid_diagrams_nonempty", bool(diagrams) and not empty, diagrams=diagrams, empty_lines=empty,
        parser_used=False, meaning="Nonempty content only; not Mermaid syntax or rendering validation.")

    source_path = confined(source_path)
    source = read_text(source_path)
    documents["source_prd"] = {"path": str(source_path), "sha256": sha256(source_path)}
    source_inventory = {
        "FR": {int(n) for n in re.findall(r"(?m)^####\s+FR-(\d+)\b", source)},
        "NFR": {int(n) for n in re.findall(r"(?m)^-\s+\*\*NFR-(\d+)\b", source)},
        "P": {int(n) for n in re.findall(r"(?m)^###\s+4\.\d+[^\n]*\bP(\d+)\b", source)},
    }
    expected = {"FR": set(range(1, 45)), "NFR": set(range(1, 11)), "P": set(range(1, 23))}
    add("source_prd_inventory", source_inventory == expected,
        counts={key: len(value) for key, value in source_inventory.items()},
        expected_counts={key: len(value) for key, value in expected.items()})
    coverage = body
    coverage_files, coverage_errors = [], []
    for entry in args.coverage:
        try:
            coverage_path = confined(root / entry)
            if not coverage_path.is_relative_to(root):
                raise ValueError("Supplemental coverage must stay in the architecture run directory.")
            content = read_text(coverage_path)
            if coverage_path.suffix.lower() == ".json":
                json.loads(content)
            elif coverage_path.suffix.lower() in {".md", ".markdown"}:
                check_targets(coverage_path, link_targets(content), f"coverage_links:{entry.as_posix()}")
            else:
                raise ValueError("Supplemental coverage must be Markdown or JSON.")
            coverage += "\n" + content
            coverage_files.append(str(coverage_path.relative_to(root)))
            documents[f"coverage:{entry.as_posix()}"] = {"path": str(coverage_path), "sha256": sha256(coverage_path)}
        except (OSError, UnicodeError, ValueError) as exc:
            coverage_errors.append({"file": str(entry), "error": str(exc)})
    add("coverage_inputs", not coverage_errors, supplemental_files=coverage_files, errors=coverage_errors,
        source_extracts_automatically_counted=False)
    for prefix, wanted in expected.items():
        found = id_references(coverage, prefix)
        label = lambda n: f"P{n:02d}" if prefix == "P" else f"{prefix}-{n}"
        add(f"coverage_{prefix}_presence", wanted.issubset(found) and not (found - wanted),
            expected_count=len(wanted), referenced_count=len(found),
            missing=[label(n) for n in sorted(wanted - found)], unexpected=[label(n) for n in sorted(found - wanted)],
            meaning="Reference presence only; ranges and slash shorthand allowed, no semantic completeness claim.")

    final_hash = sha256(path)
    add("spine_unchanged_during_check", final_hash == documents[SPINE]["sha256"],
        initial_sha256=documents[SPINE]["sha256"], final_sha256=final_hash)
    failures = sum(item["status"] == "fail" for item in checks)
    print(json.dumps({"status": "fail" if failures else "pass", "workspace": str(root),
                      "check_type": "read-only-architecture-document-check", "optional_review_run": False,
                      "runtime_conformance_tested": False, "imported_code_executed": False,
                      "documents": documents,
                      "summary": {"checks": len(checks), "passed": sum(c["status"] == "pass" for c in checks),
                                  "failed": failures, "warnings": sum(c["status"] == "warn" for c in checks)},
                      "checks": checks, "limits": limits}, indent=2, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        raise SystemExit(main())
    except (OSError, UnicodeError, ValueError, subprocess.TimeoutExpired) as exc:
        print(json.dumps({"status": "error", "error": str(exc), "runtime_conformance_tested": False}, ensure_ascii=False))
        raise SystemExit(2)
