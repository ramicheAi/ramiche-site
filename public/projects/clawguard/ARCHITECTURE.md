# ClawGuard Pro — Architecture

## Production

- **Repo:** `/Users/admin/repos/ramiche-site/src/app/clawguard/`
- **Live:** https://ramiche-site.vercel.app/clawguard
- **Deploy:** GitHub push → Vercel auto-deploy

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16, React 19 |
| Styling | Tailwind CSS 4 |
| Payments | Stripe ($299/$799/$1499) |
| Deploy | Vercel |

## Routes

| Route | Purpose |
|-------|---------|
| `/clawguard` | Product landing + pricing |
| `/clawguard/scan` | Scanner interface |

## Key Files

- `page.tsx` — Landing page with 3-tier pricing
- `scan/page.tsx` — 12-domain security scanner UI
