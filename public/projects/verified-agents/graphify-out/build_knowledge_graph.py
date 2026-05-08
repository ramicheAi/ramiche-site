#!/usr/bin/env python3
"""
Scan workspace source files, extract entities and relationships, emit graph.json.
Stdlib only. Confidence: high | medium | low.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CODE_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"}
PY_EXTS = {".py"}
CONFIG_EXTS = {".json", ".yaml", ".yml", ".toml", ".env", ".ini"}
DOC_EXTS = {".md", ".mdx"}
SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "coverage", "__pycache__", ".venv", "venv"}
SKIP_FILES = {"graph.json"}  # avoid self-referential noise from graph output

entities: list[dict] = []
relationships: list[dict] = []
_entity_ids: set[str] = set()
_rel_counter = 0


def eid(*parts: str) -> str:
    h = hashlib.sha256("|".join(parts).encode()).hexdigest()[:16]
    return f"e_{h}"


def rid() -> str:
    global _rel_counter
    _rel_counter += 1
    return f"r_{_rel_counter:06d}"


def add_entity(
    kind: str,
    name: str,
    source_path: str,
    confidence: str,
    extra: dict | None = None,
) -> str:
    uid = eid(kind, source_path, name)
    if uid in _entity_ids:
        return uid
    _entity_ids.add(uid)
    ent = {
        "id": uid,
        "kind": kind,
        "name": name,
        "sourcePath": source_path,
        "confidence": confidence,
    }
    if extra:
        ent["metadata"] = extra
    entities.append(ent)
    return uid


def add_rel(
    frm: str,
    to: str,
    rel_type: str,
    confidence: str,
    meta: dict | None = None,
) -> None:
    if not frm or not to or frm == to:
        return
    r = {
        "id": rid(),
        "from": frm,
        "to": to,
        "type": rel_type,
        "confidence": confidence,
    }
    if meta:
        r["metadata"] = meta
    relationships.append(r)


def should_skip(p: Path) -> bool:
    if any(d in SKIP_DIRS for d in p.parts):
        return True
    if p.name in SKIP_FILES and "graphify-out" in p.parts:
        return True
    return False


# --- Markdown ---
MD_HEADER = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
MD_LINK = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
MD_BOLD = re.compile(r"\*\*([^*]+)\*\*")


def resolve_local_md(from_rel: str, target: str) -> str | None:
    if "://" in target:
        return None
    t = target.split("#")[0].strip()
    if not t or t.startswith("/"):
        return None
    low = t.lower()
    if not (low.endswith(".md") or low.endswith(".mdx")):
        return None
    base = ROOT / Path(from_rel).parent
    try:
        cand = (base / t).resolve()
        rel_to_root = cand.relative_to(ROOT)
        if cand.is_file():
            return str(rel_to_root)
    except (ValueError, OSError):
        pass
    return None


def scan_markdown_body(rel: str, text: str, doc_id: str, doc_ids: dict[str, str]) -> None:
    lines = text.splitlines()
    current_section = None
    for i, line in enumerate(lines):
        m = re.match(r"^(#{1,6})\s+(.+)$", line.strip())
        if m:
            level = len(m.group(1))
            title = m.group(2).strip()
            sec_id = add_entity(
                "section",
                title,
                rel,
                "high",
                {"line": i + 1, "level": level},
            )
            add_rel(doc_id, sec_id, "contains", "high")
            if current_section and level > 1:
                add_rel(current_section, sec_id, "nests_under", "medium")
            current_section = sec_id

    for m in MD_LINK.finditer(text):
        target = m.group(2).strip()
        link_id = add_entity(
            "link_target",
            target[:200],
            rel,
            "high" if target.startswith(("http://", "https://", "/")) else "medium",
            {"anchorText": m.group(1)[:120]},
        )
        conf = "high" if target.startswith("http") else "medium"
        add_rel(doc_id, link_id, "links_to", conf)
        resolved = resolve_local_md(rel, target)
        if resolved and resolved in doc_ids:
            add_rel(doc_id, doc_ids[resolved], "references", "high", {"via": "markdown_link"})

    term_budget = 80
    for m in MD_BOLD.finditer(text):
        phrase = m.group(1).strip()
        if phrase.endswith(":") or len(phrase) < 4 or len(phrase) >= 80:
            continue
        if re.match(r"^[\d\s.]+$", phrase):
            continue
        tid = add_entity("term", phrase, rel, "low", {"inferred": True})
        add_rel(doc_id, tid, "mentions", "low")
        term_budget -= 1
        if term_budget <= 0:
            break


# --- TypeScript / JavaScript ---
RE_IMPORT_FROM = re.compile(
    r"""import\s+(?:type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]""",
)
RE_IMPORT_SIDE = re.compile(r"""import\s+['"]([^'"]+)['"]""")
RE_IMPORT_DYNAMIC = re.compile(r"""import\s*\(\s*['"]([^'"]+)['"]\s*\)""")
RE_REQUIRE = re.compile(r"""require\s*\(\s*['"]([^'"]+)['"]\s*\)""")
RE_EXPORT_FN = re.compile(
    r"\bexport\s+(?:async\s+)?function\s+(\w+)",
)
RE_EXPORT_CONST = re.compile(
    r"\bexport\s+const\s+(\w+)\s*=",
)
RE_EXPORT_TYPE = re.compile(
    r"\bexport\s+(?:type|interface)\s+(\w+)",
)
RE_EXPORT_DEFAULT = re.compile(r"\bexport\s+default\s+(?:function\s+)?(\w+)?")
RE_FN = re.compile(r"(?:async\s+)?function\s+(\w+)\s*\(")
RE_ARROW = re.compile(r"(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(")
RE_CLASS = re.compile(r"\bclass\s+(\w+)")
RE_PYTHON_DEF = re.compile(r"^def\s+(\w+)\s*\(", re.MULTILINE)
RE_PYTHON_CLASS = re.compile(r"^class\s+(\w+)", re.MULTILINE)
RE_PYTHON_IMPORT = re.compile(r"^(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))", re.MULTILINE)


def scan_ts_js(path: Path, rel: str, text: str) -> None:
    mod_id = add_entity("module", path.stem, rel, "high", {"language": "ts_js"})
    seen: set[str] = set()
    for rx in (RE_IMPORT_FROM, RE_IMPORT_SIDE, RE_IMPORT_DYNAMIC, RE_REQUIRE):
        for m in rx.finditer(text):
            target = m.group(1)
            if target in seen:
                continue
            seen.add(target)
            tid = add_entity("import_target", target, rel, "high")
            add_rel(mod_id, tid, "imports", "high", {"raw": target})

    for name in RE_EXPORT_FN.findall(text):
        fid = add_entity("function", name, rel, "high", {"export": True})
        add_rel(mod_id, fid, "defines", "high")
    for name in RE_EXPORT_CONST.findall(text):
        vid = add_entity("value", name, rel, "medium", {"export": True})
        add_rel(mod_id, vid, "defines", "medium")
    for name in RE_EXPORT_TYPE.findall(text):
        tid = add_entity("type", name, rel, "high", {"export": True})
        add_rel(mod_id, tid, "defines", "high")
    for m in RE_EXPORT_DEFAULT.finditer(text):
        name = m.group(1)
        if name:
            fid = add_entity("function", name, rel, "medium", {"export": "default"})
            add_rel(mod_id, fid, "defines", "medium")

    for name in RE_FN.findall(text):
        if name not in ("if", "for", "while", "catch"):
            fid = add_entity("function", name, rel, "medium", {"export": False})
            add_rel(mod_id, fid, "defines", "medium")
    for name in RE_ARROW.findall(text):
        aid = add_entity("function", name, rel, "low", {"style": "arrow"})
        add_rel(mod_id, aid, "defines", "low")
    for name in RE_CLASS.findall(text):
        cid = add_entity("type", name, rel, "high", {"kind": "class"})
        add_rel(mod_id, cid, "defines", "high")


def scan_python(path: Path, rel: str, text: str) -> None:
    mod_id = add_entity("module", path.stem, rel, "high", {"language": "python"})
    for m in RE_PYTHON_IMPORT.finditer(text):
        raw = m.group(1) or m.group(2) or ""
        raw = raw.strip().split()[0] if raw else ""
        if raw:
            tid = add_entity("import_target", raw, rel, "medium")
            add_rel(mod_id, tid, "imports", "medium")
    for name in RE_PYTHON_DEF.findall(text):
        if not name.startswith("_"):
            fid = add_entity("function", name, rel, "high")
            add_rel(mod_id, fid, "defines", "high")
    for name in RE_PYTHON_CLASS.findall(text):
        cid = add_entity("type", name, rel, "high", {"kind": "class"})
        add_rel(mod_id, cid, "defines", "high")


def scan_config(path: Path, rel: str, text: str) -> None:
    ext = path.suffix.lower()
    cid = add_entity("config", path.name, rel, "high", {"format": ext})
    if ext == ".json":
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                for k in list(data.keys())[:200]:
                    kid = add_entity("config_key", f"{path.name}:{k}", rel, "high")
                    add_rel(cid, kid, "has_key", "high")
        except json.JSONDecodeError:
            add_entity("parse_note", "json_invalid", rel, "low")


def scan_file(path: Path) -> None:
    rel = str(path.relative_to(ROOT))
    if should_skip(path):
        return
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return

    ext = path.suffix.lower()
    if ext in DOC_EXTS:
        return
    if ext in CODE_EXTS:
        scan_ts_js(path, rel, text)
    elif ext in PY_EXTS:
        scan_python(path, rel, text)
    elif ext in CONFIG_EXTS:
        scan_config(path, rel, text)
    elif path.name == "Dockerfile":
        add_entity("config", "Dockerfile", rel, "high", {"format": "dockerfile"})


def main() -> None:
    global entities, relationships, _entity_ids, _rel_counter
    entities = []
    relationships = []
    _entity_ids = set()
    _rel_counter = 0

    all_paths: list[Path] = []
    for p in ROOT.rglob("*"):
        if p.is_file() and not should_skip(p):
            ext = p.suffix.lower()
            if ext in DOC_EXTS | CODE_EXTS | PY_EXTS | CONFIG_EXTS:
                all_paths.append(p)
            elif p.name in ("Dockerfile",):
                all_paths.append(p)

    all_paths.sort(key=lambda x: str(x))

    doc_ids: dict[str, str] = {}
    for p in all_paths:
        if p.suffix.lower() not in DOC_EXTS:
            continue
        rel = str(p.relative_to(ROOT))
        doc_ids[rel] = add_entity(
            "document",
            p.name,
            rel,
            "high",
            {"extension": p.suffix.lower()},
        )

    for p in all_paths:
        if p.suffix.lower() in DOC_EXTS:
            rel = str(p.relative_to(ROOT))
            try:
                t = p.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            scan_markdown_body(rel, t, doc_ids[rel], doc_ids)
        else:
            scan_file(p)

    out = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "root": str(ROOT),
            "scanner": "graphify-out/build_knowledge_graph.py",
            "version": 1,
            "fileCount": len(all_paths),
            "markdownDocuments": len(doc_ids),
            "entityCount": len(entities),
            "relationshipCount": len(relationships),
            "confidenceLegend": {
                "high": "Explicit syntax or path-resolvable reference",
                "medium": "Static pattern match or structural inference",
                "low": "Heuristic or ambiguous extraction",
            },
        },
        "entities": entities,
        "relationships": relationships,
    }

    out_path = ROOT / "graphify-out" / "graph.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out_path} ({len(entities)} entities, {len(relationships)} relationships)")


if __name__ == "__main__":
    main()
