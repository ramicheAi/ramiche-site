# METTLE — Pipeline

## Current Sprint Flow

```
QUEUED → IN PROGRESS → REVIEW → DEPLOY → VERIFIED
```

### QUEUED
- Firebase Authentication upgrade (replace localStorage auth with Firebase Auth)
- Cognitive load audit
- Parent portal: coach-side athlete preview
- Mobile verification on M5 MacBook Pro
- SwimCloud meet/date parsing fix (times return but meet name + date fields empty)

### IN PROGRESS
(none)

### REVIEW
(none)

### DEPLOY
(none)

### VERIFIED (Mar 8)
- Best Times Fetch — SwimCloud API + USA Swimming ID matching + Firestore cache + athlete detail UI (Mar 8)
- Security: role-based portal isolation — coach/athlete/parent strict separation (Mar 8)
- Session extended 24h → 30 days + smart root redirect (Mar 8)
- MASTER_PIN preserved after security hardening — regression caught + fixed (Mar 8)
- Command Center: smart refresh, dark mode all pages, auto-update (missions/schedule/notifications) (Mar 8)
- Full project docs for all 8 projects (Mar 8)

### VERIFIED (Mar 7)
- Server-side redirect fix (Mar 7)
- Rogue `app/` directory removal (Mar 7)
- Portal switcher restoration — COACH | ATHLETE | PARENT (Mar 7)
- Duplicate Parent tab removal (Mar 7)
- Demo page steps 1-5 polish — animations, counters, level glow, heartbeat CTA, sound effects (Mar 7)
- Vercel prerender cache fix — no-cache headers on all METTLE paths (Mar 7)

---

## Pipeline Rules

1. **One task moves through ALL stages before next task starts** (unless parallelized to different agents)
2. **REVIEW = must be verified in browser** — curl + visual check
3. **DEPLOY = vercel --prod --force** — check `age: 0` header
4. **VERIFIED = Ramon confirms OR curl returns expected content**
5. **Blocked items stay in their stage** with a `BLOCKED:` prefix and reason
6. **AUTH CHANGES — ATOMIC ONLY:** one commit per auth change, verify MASTER_PIN works after each
