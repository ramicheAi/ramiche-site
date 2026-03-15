# Parallax Site — Pipeline

## Current Sprint Flow

```
QUEUED → IN PROGRESS → REVIEW → DEPLOY → VERIFIED
```

### QUEUED
- Firebase auth integration

### IN PROGRESS
- GitHub repo creation + Vercel connection

### REVIEW
- Route audit — audit complete, 5 routes need Ramon's decision (see `memory/night-shift-2026-03-09.md`)

### DEPLOY
(none)

### VERIFIED
- Agent marketplace e2e (Feb 21)
- /forge tools hub (Feb)
- White-label system (Feb)

---

## Pipeline Rules

1. One task through ALL stages before next starts
2. REVIEW = browser verified
3. DEPLOY = vercel --prod --force, check age: 0
4. VERIFIED = Ramon confirms OR curl OK
5. BLOCKED items get prefix + reason
