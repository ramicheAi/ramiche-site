# Parallax — Decision Log

## Architecture

| Date | Decision | Why | Alternatives Considered |
|------|----------|-----|------------------------|
| 2026-01 | Separate repo from ramiche-site | Clean deploys, independent scaling | Monorepo |
| 2026-01 | Direct Vercel deploy (no Git) | Faster iteration, no CI overhead | GitHub auto-deploy |
| 2026-02 | White-label system for agents | Scalable distribution model | Manual per-agent setup |
| 2026-02 | Stripe for skills payments | Already wired, trusted | Gumroad, LemonSqueezy |
| 2026-02 | Resend for transactional email | Developer-friendly, good DX | SendGrid, Mailgun |
| 2026-02 | Light theme | Brand differentiation from METTLE (dark) | Dark theme |

## Business

| Date | Decision | Why |
|------|----------|-----|
| 2026-01 | Agent marketplace model | Recurring revenue from skills, scalable | One-time sales |
| 2026-02 | $149-$499 skill pricing | Accessible entry, premium upsell | Flat rate |
| 2026-02 | Setup service offering | High-touch onboarding = trust builder | Self-serve only |
