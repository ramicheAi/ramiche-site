# Acceptance run 2026-11-16T21:40:41.072Z

| id | journey | class | result | evidence |
|---|---|---|---|---|
| A | Send a message and receive the agent response | integrated | **PASS** | persisted + visible + exactly one dispatch + delivered |
| B | Send a message with an attachment | integrated | **PASS** | attachment persisted ({"url":"http://127.0.0.1:54329/storage/v1/object/public/chat-attachments/cc/1794) |
| B2 | A failed attachment upload cannot send, and can be retried or dropped | integrated | **PASS** | failed upload is visible and blocks the send; retry stores it; removal sends text only |
| C | Reload the page and recover the conversation | integrated | **PASS** | both turns survived a full reload |
| D1 | Approve a synthesis request | integrated | **PASS** | approve control present; approved_at written, dispatches=1, relay=delivered |
| D2 | Reject a synthesis request | integrated | **BLOCKED** | no rejection contract exists: the only terminal state is metadata.approved_at, and no route records a rejectio |
| E | Duplicate clicks do not duplicate execution | integrated | **PASS** | one persisted message, one agent turn |
| F | Lost acknowledgment, then retry | integrated | **PASS** | dispatches=1, user rows=2 |
| G | Backend failure produces actionable feedback | integrated | **PASS** | operator sees a failure; relay state=unknown |
| H | Classic console message workflow | integrated | **PASS** | no dead composer; the screen explains it and links to the working chat |
| Z | Isolation: the harness cannot reach a real service | simulated | **PASS** | boot refuses a hosted Supabase URL and never starts the fake backends on top of it |
| I | Visible delivery state matches backend outcome | integrated | **PASS** | row=read/delivered (read is a later legal state), reply visible, no false banner |
| M | Mobile viewport (390x844) visual acceptance | integrated | **PASS** | send control 320:62x44 390:62x44 1440:62x44; overflow 320:0 390:0 1440:0; reply=true |

Counts: {"PASS": 12, "BLOCKED": 1}

Artifacts: `e2e/artifacts/2026-11-16T21-39-26-273Z`
