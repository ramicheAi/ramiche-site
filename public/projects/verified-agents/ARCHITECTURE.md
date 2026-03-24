# Verified AI Agent Business — Architecture

## System Design
- **Platform:** Parallax marketplace (ClawHub infrastructure)
- **Agent hosting:** OpenClaw instances per verified agent
- **Knowledge storage:** Expert interviews → transcribed → structured → encoded into agent SOUL.md + MEMORY.md
- **Certification engine:** Test battery (100 scenarios per vertical) + expert grading
- **Rental system:** Hourly billing via Stripe, session-based access
- **Quality monitoring:** Client ratings, automated output audits, annual re-certification

## Credential Vault (OneCLI Pattern — Mar 13)
- **Pattern:** Agents use placeholder tokens. Vault injects real secrets per-request.
- **Encryption:** AES-256, per-agent scoped access.
- **Audit:** Every credential access logged with timestamp, agent ID, request context.
- **Client dashboard:** Shows exactly what each agent can access (read-only view).
- **Differentiator:** "Your data never touches the AI directly."

## Certification Levels
1. Bronze — AI-generated knowledge, no expert
2. Silver — Single expert interview (4-8 hrs)
3. Gold — Multiple experts (20+ hrs)
4. Platinum — Ongoing expert supervision + continuous learning
