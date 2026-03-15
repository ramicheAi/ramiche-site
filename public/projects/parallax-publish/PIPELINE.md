# Parallax Publish — Pipeline

## Current Sprint Flow

```
QUEUED → IN PROGRESS → REVIEW → DEPLOY → VERIFIED
```

### QUEUED
- Instagram OAuth fix
- Scheduling backend migration

### IN PROGRESS
(none)

### REVIEW
(none)

### DEPLOY
(none)

### VERIFIED
- Twitter OAuth2 (Feb 27)
- LinkedIn OAuth2 (Feb 27)
- Bluesky AT Protocol (Feb 27)

---

## Pipeline Rules

1. One task moves through ALL stages before next task starts
2. REVIEW = must be verified in browser
3. DEPLOY = vercel --prod --force — check age: 0
4. VERIFIED = Ramon confirms OR curl returns expected
5. Blocked items stay with BLOCKED: prefix and reason
