# Claude Max proxy: system-prompt transport patch

Problem: the proxy (`claude-max-api-proxy` 1.0.0 + local vision patch) wrapped OpenAI `system`
messages as `<system>...</system>` text inside the stdin user prompt of the real Claude Code CLI,
so Claude Code's own identity won over the Parallax agent frame.

Fix: system text is sent on the CLI's real system-prompt channel, `--append-system-prompt`
(appends to Claude Code's default prompt; never `--system-prompt`, which replaces it). One flag:
tool-mapping prompt + blank line + caller system text. User/assistant turns stay on stdin.

- Kill switch: `PROXY_SYSTEM_TRANSPORT=legacy` restores the old in-prompt behaviour.
- Size guard: over `PROXY_SYSTEM_ARG_MAX_BYTES` (default 100000) falls back to legacy, logged to stderr.
- No `--session-id`, no session reuse added.

Apply (offline copy first, then the live dist during an approved deploy window):

    node apply-system-prompt-transport.mjs <dist-dir>          # writes *.pre-system-transport.bak
    node apply-system-prompt-transport.mjs <dist-dir> --check

Fails loud on anchor drift or double-apply. If `~/.openclaw/apply-proxy-vision-patch.sh` is re-run
on a fresh install, apply the vision patch first, then this one. Tests:
`src/lib/claude-max-proxy-transport.test.ts` (fake CLI recording argv + stdin).
Not covered here: proxy user-level CLAUDE.md, hooks, skills, MCP, `--dangerously-skip-permissions`.
