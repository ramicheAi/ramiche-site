# Parallax Site — Architecture

## Production

- **Repo:** `/Users/admin/parallax-site/` (NOT in repos/ folder)
- **Live:** https://parallax-site-ashen.vercel.app
- **Vercel project:** parallax-site (prj_jlGaq2CBbr4EzxlGh7D7icL2IIL8)
- **Deploy:** `vercel --prod` (NO git repo — needs GitHub setup)
- **Theme:** Light mode (white background)

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16, React 19 |
| Styling | Tailwind 4 |
| Payments | Stripe |
| Email | Resend |
| Auth | None yet (needs Firebase) |
| Deploy | Vercel (CLI only, no GitHub) |

## Routes (19 total)

- Agent marketplace + Claude Skills ($149-499)
- Setup Service (verified e2e)
- /forge — creative tools hub (6 tools)
- /publish — landing page for Parallax Publish
- /agents — real payment-to-delivery e2e

## Key Systems

- White-label system: 115 files, 7,554 LOC, 20 agents, 7 bundles
- First external deployment: Derrick (Windows, Feb 21)

## Audit (Feb 27)
- 9 functional routes, 7 marketing-only, 2 partial, 1 fixed
- Only /agents has real payment-to-delivery e2e

## Known Issues

- NO git repo — deploys via `vercel --prod` only
- No Firebase auth yet
- Homepage was redirecting to /command-center (stale Vercel prerender — needs redeploy)
