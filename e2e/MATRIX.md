# Acceptance run 2026-11-16T20:43:03.618Z

| id | journey | class | result | evidence |
|---|---|---|---|---|
| A | Send a message and receive the agent response | integrated | **PASS** | persisted + visible + exactly one dispatch + delivered |
| B | Send a message with an attachment | integrated | **PASS** | attachment persisted ({"url":"http://127.0.0.1:54329/storage/v1/object/public/chat-attachm |
| C | Reload the page and recover the conversation | integrated | **PASS** | both turns survived a full reload |
| D1 | Approve a synthesis request | integrated | **PASS** | approve control present; approved_at written, dispatches=1, relay=delivered |
| E | Duplicate clicks do not duplicate execution | integrated | **PASS** | one persisted message, one agent turn |
| F | Lost acknowledgment, then retry | integrated | **PASS** | dispatches=1, user rows=2 |
| G | Backend failure produces actionable feedback | integrated | **PASS** | operator sees a failure; relay state=unknown |
| H | Classic console message workflow | integrated | **BLOCKED** | /command-center/legacy renders the v6 mission-control dashboard, not a classic console; it |
| Z | Isolation: the harness cannot reach a real service | simulated | **PASS** | boot refuses a hosted Supabase URL and never starts the fake backends on top of it |
| I | Visible delivery state matches backend outcome | integrated | **PASS** | row=read/delivered (read is a later legal state), reply visible, no false banner |
| M | Mobile viewport (390x844) visual acceptance | integrated | **PASS** | overflow=0px, reply=true, send button=62x29px |

Counts: {"PASS": 10, "BLOCKED": 1}

Artifacts: `e2e/artifacts/2026-11-16T20-42-03-358Z`
