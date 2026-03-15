# Parallax — Architecture

## Production

- **Repo:** `/Users/admin/parallax-site/`
- **GitHub:** ramicheAi/parallax-site
- **Live:** https://parallax-site-ashen.vercel.app
- **Deploy:** `vercel --prod --force` (no git repo — direct deploy)

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16, React 19 |
| Styling | Tailwind CSS 4 |
| Payments | Stripe |
| Email | Resend |
| Deploy | Vercel (direct, no GitHub auto-deploy) |

## Routes (19 total)

| Route | Purpose |
|-------|---------|
| `/` | Homepage |
| `/agents` | Agent marketplace + Claude Skills ($149-499) |
| `/forge` | Creative tools hub (6 tools) |
| `/publish` | Publishing landing page |
| `/setup` | Setup service (verified e2e) |

## Key Facts

- Light theme (white background) — exception is NOT applicable here, Parallax Site uses light mode
- No Firebase yet — needs to be added for auth
- White-label system: 115 files, 7,554 LOC, 20 agents, 7 bundles
- First external deployment: Derrick (Windows, Feb 21)
