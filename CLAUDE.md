@AGENTS.md

## Parallax capability registry (read this before building anything)

Before you build a tool, do a task by hand, or conclude something is not possible, check
what already exists: **[PARALLAX-CAPABILITIES.md](PARALLAX-CAPABILITIES.md)** at this repo
root. It lists every reusable Parallax tool, product, and system with how to invoke it.

It is committed here on purpose so it survives a fresh clone (cloud containers have no
`~/.openclaw`). On a fleet host the canonical copy is `~/.openclaw/CAPABILITIES.md`, and
`python3 ~/.openclaw/recall.py "<thing>"` searches every past session.
