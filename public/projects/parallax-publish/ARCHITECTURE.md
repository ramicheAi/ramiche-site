# Parallax Publish — Architecture

## Production

- **Repo:** `/Users/admin/repos/parallax-publish/`
- **Live:** https://parallax-publish.vercel.app
- **Deploy:** Vercel (auto from GitHub)

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js, React |
| Styling | Tailwind CSS |
| Language | TypeScript |
| Auth | OAuth2 (Twitter, LinkedIn), AT Protocol (Bluesky) |
| Deploy | Vercel |

## Platforms

| Platform | Status | Auth Method |
|----------|--------|-------------|
| Twitter/X | LIVE | OAuth2 |
| LinkedIn | LIVE | OAuth2 |
| Bluesky | LIVE | AT Protocol |
| Instagram | BLOCKED | Facebook Developer Portal permissions |
| Facebook | Not started | — |
| Threads | Not started | — |
| TikTok | Not started | — |
| YouTube | Not started | — |

## Routes / Tabs

1. Compose — draft + publish posts
2. History — past posts
3. Calendar — scheduling view
4. Accounts — connected platforms
5. Analytics — engagement metrics
6. AI Writer — AI-assisted content

## Key Gaps

- Scheduling backend (SQLite → needs hosted DB)
- Real analytics (currently placeholder)
- Instagram blocked on Facebook permissions
