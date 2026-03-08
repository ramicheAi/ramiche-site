# METTLE — Pipeline

## Current Sprint Flow

```
QUEUED → IN PROGRESS → REVIEW → DEPLOY → VERIFIED
```

### QUEUED
- Best Times Fetch implementation
- Firebase Authentication upgrade
- Cognitive load audit
- Parent portal: coach-side athlete preview
- Mobile verification on M5 MacBook Pro

### IN PROGRESS
- Demo page UI/UX enhancement (step 2+: animations, counters, game-like polish)

### REVIEW
(none)

### DEPLOY
(none)

### VERIFIED (Mar 7-8)
- Server-side redirect fix (Mar 7)
- Rogue `app/` directory removal (Mar 7)
- Portal switcher restoration — COACH | ATHLETE | PARENT (Mar 7)
- Duplicate Parent tab removal (Mar 7)
- Demo page step 1 polish — spacing, pulse, hover (Mar 7)
- Vercel prerender cache fix — no-cache headers on all METTLE paths (Mar 7)

---

## Pipeline Rules

1. **One task moves through ALL stages before next task starts** (unless parallelized to different agents)
2. **REVIEW = must be verified in browser** — curl + visual check
3. **DEPLOY = vercel --prod --force** — check `age: 0` header
4. **VERIFIED = Ramon confirms OR curl returns expected content**
5. **Blocked items stay in their stage** with a `BLOCKED:` prefix and reason
