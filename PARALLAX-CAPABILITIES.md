# PARALLAX CAPABILITIES REGISTRY

**What this is:** the single index of every reusable tool, product, and system Parallax owns.

**Why it exists:** a session working in one repo has no way to know a tool built in another
repo exists, so it rebuilds it or does the work by hand. That is the most expensive failure
mode we have. Two real cases on 2026-08-15: a session in `~/mettle` could not find
parallax-publish, and a session in a fresh CLOUD CONTAINER could not find this file at all.

**How it reaches every surface:**
1. **Local sessions** — the global SessionStart hook (`~/.openclaw/hooks/session_start_context.py`)
   injects an index of this file into every session on this machine.
2. **Cloud containers / other clones** — this file is COMMITTED into the repos
   (`PARALLAX-CAPABILITIES.md` at repo root) and pointed at from each repo's `CLAUDE.md`,
   because a container only ever has what git gave it. `$HOME` there is `/root` and
   `~/.openclaw` does not exist.
3. **Fleet agents** — reachable via the same path on the gateway host.

**Maintainer rule (human or agent):** ship a tool another session could need, add its line
here in the same pass, and re-run `bash ~/.openclaw/sync-capabilities.sh` to push it into the
repos. A capability nobody can find does not exist.

**If you are in a container and something here is not on disk:** it lives on the fleet host,
not in your clone. Use the API/URL listed, or ask for it to be run on the host.

---

## PUBLISHING AND CONTENT

- **parallax-publish** | `~/parallax-publish` | LIVE **https://parallax-publish.vercel.app**
  Multi-account social publishing + content engine. 6 Instagram accounts connected and
  verified (galactikantics, ramichemusic, mettle.arena, parallaxventures, ramichestudio, and
  sa_aquatics which is CLIENT-LOCKED and refuses to publish). Publishes now or scheduled to
  many accounts at once with per-account results, cross-posts to 24h Stories, uploads media to
  public blob storage, scans accounts for real metrics, derives per-account brand voice from
  their own captions, generates hook-doctrine briefs, and learns from measured results.
  API (session cookie): `/api/accounts`, `/api/accounts/:id/scan`,
  `/api/accounts/:id/plan?briefs=5`, `/api/accounts/:id/voice` (POST),
  `/api/accounts/:id/learnings`, `/api/upload`, `/api/publish`.
  GATE: publishing is public and irreversible. NO account is a test account.
- **instagram_publish.py** | `~/.openclaw/instagram_publish.py` | Standalone Graph API publisher
  for owned IG accounts, no web app. `status|refresh|post <account> <url> --caption "…"`.
  Hard-refuses sa_aquatics.
- **content_engine.py** | `~/.openclaw/content_engine.py` | Daily content conveyor: picks the
  pillar, pulls a real exhibit from the journal, drafts one post into the social-manager queue
  as `draft`, never auto-approved. `--nag` chases content debt.
- **media_host.py** | `~/.openclaw/media_host.py` | Uploads media to public blob storage, ffprobe
  preflight against the Instagram reel spec, then proves anonymous public reachability.
- **social-manager** | `~/openclaw-src/extensions/social-manager` | Gated draft-to-post queue in
  front of conductor. No agent-reachable send path; only a human-approved draft can post.

## VIDEO AND MEDIA

- **Remotion** | `~/openclaw-src/extensions/remotion/studio` | React to MP4 at volume.
  `./render.sh <Composition> --props '<json>'`
- **Hyperframes** | `~/hyperframes` | HTML+GSAP deterministic short-form video.
  `npx hyperframes init|lint|inspect|preview|render`
- **image-blaster** | `~/image-blaster` | Single image to 3D environment/mesh/SFX.
- **GALACTIK-LAB-JUCE** | `~/GALACTIK-LAB-JUCE` | C++ JUCE source compiling to VST3/AU/AAX plugins.

## MEMORY AND KNOWLEDGE

- **recall.py** | `~/.openclaw/recall.py` | Searches EVERY past session transcript across all
  projects, the journal, LESSONS.md, doctrine, and the Obsidian vault. ~15s.
  `python3 ~/.openclaw/recall.py "<thing>"` · write back with `--lesson "<what you learned>"`.
  LAW: run before asking Ramon any fact or re-deriving any technique.
- **journal.py** | `~/.openclaw/journal.py` | Shared cross-machine fleet work journal.
  `standup` to read · `log <agent> <shipped|blocked|failed|decision> "…"` to write.
- **knowledge_publish.py** | `~/.openclaw/knowledge_publish.py` | Publishes distilled lessons to
  LESSONS.md, the vault, the RAG store, and graphify. Content-hash deduped.
- **harvest_sessions.py** | `~/.openclaw/harvest_sessions.py` | Mines raw transcripts for
  lesson-signal passages ahead of distillation.
- **vault_maintain.py** | `~/.openclaw/vault_maintain.py` | Nightly Obsidian vault maintenance,
  auto-links notes and wires orphans into MOC hubs. Additive only.
- **doctrine_self_audit.py** | `~/.openclaw/doctrine_self_audit.py` | Weekly staleness check on
  standing doctrine. Reports, never auto-edits.
- **knowledge / memory-core / memory-lancedb** | `~/openclaw-src/extensions/` | RAG over ingested
  documents with citations, plus long-term agent memory with auto-recall.
- **graphify** | MCP servers `graphify-ventures` and `graphify-openclaw` | Cross-repo code
  knowledge graphs. Also the `graphify` and `absorb-repo` skills.

## FLEET AND ORCHESTRATION

- **conductor** | `~/openclaw-src/extensions/conductor` | Multi-model orchestration brain: egress
  trust guard, injection firewall, difficulty router, cross-lab panel, evidence fact-check,
  learning loop.
- **witness.py** | `~/.openclaw/witness.py` | Fleet heartbeat + service watchdog. Telegrams on
  state transitions only. `check|status|beat NAME`
- **work_intake.py** | `~/.openclaw/work_intake.py` | Daily: assigns up to 3 real tasks to fleet
  agents from PRIORITIES.md + journal. Prep-and-hold only.
- **fleet_regrade.py** | `~/.openclaw/fleet_regrade.py` | Monthly deterministic accountability
  re-grade of every agent (SHIPPING/THEATER/SILENT) from journal + real files produced.
- **builder** | `~/openclaw-src/extensions/builder` | Dispatches coding/design tasks to a
  tool-enabled Claude Code via the local Claude Max proxy.
- **agent-eval** | `~/openclaw-src/extensions/agent-eval` | Scores agent/model output against
  deterministic checks plus LLM-judged rubrics.
- **mcp-client** | `~/openclaw-src/extensions/mcp-client` | Surfaces MCP server tools to fleet agents.
- **lobster** | `~/openclaw-src/extensions/lobster` | Typed pipelines with resumable approvals.
- **Watchdogs** | `~/.openclaw/*watchdog*` | Gateway, model-proxy, LM Studio context, and
  stranded-reply guards against silent outages.
- **Channel plugins** | `~/openclaw-src/extensions/` | telegram, slack, discord, whatsapp, signal,
  imessage, matrix, msteams, googlechat, line, mattermost, nostr, twitch, zalo, and more.

## BUSINESS AND OPS

- **ops_pulse.py** | `~/.openclaw/ops_pulse.py` | Daily Telegram digest: money, leads awaiting
  approval, content status, fleet ship/block.
- **coo-standup** skill | Daily standup and weekly retro across ventures.
- **nepq-sales** skill | The NEPQ question engine for every sales surface. Drafts only, sends gated.
- **parallaxbet-engine** | `~/parallaxbet-engine` | Sports-betting edge detection: EV scanner,
  fair-odds modeling, Kelly staking, parlay builder, backtest harness, FastAPI service.
  Real money is HARD-GATED to Ramon. Paired with the `kelly-bet` skill.
- **power-challenge** | `~/power-challenge` | Competition platform: registration, waivers, Stripe.
- **parallax-site** | `~/parallax-site` | Parallax's own site: AI concierge, BEACON playbooks.

## PRODUCTS AND CLIENT WORK

- **mettle** | `~/mettle` | LIVE **mettle-arena.vercel.app** | Swim coaching/ops platform: coach
  check-ins, athlete rosters, SafeSport/MAAPP compliance, broadcast and family features.
- **scoww** | `~/scoww` | LIVE **scoww.vercel.app** | Sid Cassidy Open Water Weekend event site.
- **galactik-antics** | `~/galactik-antics-real` (working tree; `~/galactik-antics` is the older
  checkout, same Vercel project) | Galactik Antics store + lore hub, Stripe + Printful.
- **saint-andrews-aquatics** | `~/saint-andrews-aquatics` | CLIENT brand identity + homepage package.
- **VANTAGE / MERIDIAN OPS** | `~/vantage` | Secure digital-twin ops intelligence for
  defense-grade manufacturing. First engagement Cirexx.
- **NUVYRA** | `~/clients/nuvyra`, `~/clients/nuvyra-system` | Physician-acquisition system:
  NPPES to enrichment to Apollo/HubSpot to Cal.com. 2,872 scored FL physician leads.
- **MLG Brands (KITSMITH)** | `~/clients/mlg-brands` | Wholesale kitting decision layer. Pre-discovery.
- **ramiche-site** | `~/ramiche-site` | Automation Dock: today's priorities, queues, drafts, PRs.

## RESEARCH AND INTEL

- **parallax-content-analysis** | `~/parallax-content-analysis` | Social content performance
  analysis, ComfyUI generation scripts, the content-engine doctrine.
- **swim-systems** | `~/swim-systems` | Swim competition tech R&D. Research stage.
- **shroom** | `~/shroom` | Evidence-graded fungi reference; build fails if a claim outranks its
  citations.
- **ASI-Evolve** | `~/ASI-Evolve` | Agentic research loop: literature to hypothesis to experiment.
- **parallax-gta** | `~/parallax-gta` | CFX/FiveM marketplace research. Draft stage.

## CREATIVE SYSTEMS (Claude Code skills, invoked via the Skill tool)

- **Load `pantheon-studio` FIRST** for any creative task; it routes to the right discipline.
  18 discipline systems: proteus (web/interactive), orpheus (audio), mythos (story), kinema
  (film), anima (animation/3D), topos (live/space), ludus (game), sigil (brand), forge
  (product), sensoria (multisensory), chroma (color), axis (art direction), lumen
  (photography), codex (editorial/layout), prism (data-viz), quill (illustration), catalyst
  (advertising, spend-gated).
- **QA gates:** brand-visual-qa, proteus-qa, reel-qa, coherence-qa, adversarial-review.
- **Content pipeline:** production-pipeline, content-brief, adapt-and-localize,
  resonance-engine, virality-score, midjourney-studio, figma-weave, galactik-asset.
- **Method:** `operator-method` (load first for any non-trivial task),
  `parallax-output-standards`.
- **Video:** remotion, watch, youtube-transcript, video-use.
- **Dev:** absorb-repo, graphify, touchpad, indexing-audit, the Cloudflare stack.

## DEV TOOLING

- **hb_pull.py** | `~/.openclaw/hb_pull.py` | Sandboxed hash-verified model-weight acquisition.
  Refuses pickle formats; canonical sha256 comes from the user, never the source.
- **drive-score** | `~/drive-score` | OBD-II vehicle telemetry over serial.
- **MCP servers configured:** chrome-devtools, playwright, magic, composio, graphify-ventures,
  graphify-openclaw, pika-mcp.

---

## KNOWN CLEANUP (flagged, not yet done)
- `~/parallax` and `~/parallaxbet-engine` hold divergent copies of the same betting code, and
  `~/parallax` also carries unrelated music-ops docs. A session could edit the stale copy.
- `~/tiktok-agent` looks superseded by parallax-publish / instagram_publish.py.
- `~/galactik-antics` vs `~/galactik-antics-real` share one Vercel project; `-real` is the
  working tree.
- `~/themis-demo` and `~/themis-imac` are alternate checkouts of the OpenClaw framework itself,
  not separate capabilities.

## HOW TO FIND CAPABILITY FROM ANYWHERE
1. `cat ~/.openclaw/CAPABILITIES.md` (local) or `cat PARALLAX-CAPABILITIES.md` (in-repo copy)
2. `python3 ~/.openclaw/recall.py "<capability>"` (every session ever, local only)
3. `python3 ~/.openclaw/journal.py standup` (what the fleet shipped recently, local only)
