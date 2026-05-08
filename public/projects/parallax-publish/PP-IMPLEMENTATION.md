# Parallax Publish — Full Implementation Plan
## Audit Results + Enhancement Roadmap (for Cursor)

**Repo:** `/Users/admin/parallax-publish/`
**Live:** https://parallax-publish.vercel.app
**Stack:** Next.js 16 + TypeScript + Tailwind + Prisma/SQLite

---

## PHASE 1: Critical Fixes (End-to-End Publishing Broken)

### Fix 1: SQLite → Vercel-Compatible DB
**Problem:** `prisma` is `null` on Vercel (SQLite can't run in serverless). Scheduling returns 503. Post history only lives in localStorage.
**File:** `src/lib/db.ts`, `prisma/schema.prisma`
**Fix:** Migrate to Turso (libSQL) or Vercel Postgres. Turso is simplest — free tier, edge-compatible, SQLite-compatible syntax.
```
1. npm install @libsql/client @prisma/adapter-libsql
2. Update prisma/schema.prisma: provider = "sqlite" stays, add turso adapter
3. Update src/lib/db.ts: use Turso client with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN env vars
4. Add env vars to Vercel dashboard
5. Run prisma db push
```

### Fix 2: Cron Publish Route Doesn't Actually Publish
**Problem:** `/api/cron/publish` (line 30) just marks posts as "PUBLISHED" — it never calls the Twitter/LinkedIn/Bluesky providers to actually post.
**File:** `src/app/api/cron/publish/route.ts`
**Fix:** After finding due posts, parse the `title` JSON to get platforms, then call the appropriate provider (Twitter/LinkedIn/Bluesky) with stored credentials from `SocialProfile` table. Mark as PUBLISHED only on success, FAILED on error.

### Fix 3: Account Connection Not Persisted
**Problem:** Connected accounts are hardcoded in `useState` (page.tsx line 58-62). OAuth tokens stored in cookies. On page refresh or new browser, all connections reset to the 3 hardcoded ones.
**File:** `src/app/page.tsx` lines 58-62
**Fix:**
1. On mount, fetch connected accounts from `/api/accounts` (new endpoint)
2. `/api/accounts` reads from `SocialProfile` table
3. After OAuth callback, save the token to `SocialProfile` not just a cookie
4. Remove the 3 hardcoded accounts from `useState`

### Fix 4: Media Upload Path Broken on Vercel
**Problem:** `src/app/api/upload/route.ts` likely writes to local filesystem which doesn't persist on Vercel serverless.
**File:** `src/app/api/upload/route.ts`
**Fix:** Upload to Vercel Blob Storage or Cloudflare R2. Return a public URL. Update publish flow to use the URL when posting to platforms.

---

## PHASE 2: Missing Features (Make It Actually Useful)

### Fix 5: Post History from DB, Not localStorage
**Problem:** `recentPosts` only lives in `localStorage` (line 77). Different browser = no history. Vercel = no persistence.
**File:** `src/app/page.tsx` lines 76-83, 121-127
**Fix:**
1. On mount, fetch from `GET /api/schedule` (already exists, returns posts from DB)
2. After successful publish, save to DB via new `POST /api/history` endpoint
3. Remove localStorage read/write
4. Keep localStorage as offline cache only

### Fix 6: Analytics Tab — Real Engagement Data
**Problem:** Analytics only counts posts from localStorage. No impressions, likes, comments, shares.
**File:** `src/app/page.tsx` lines 1058-1108 (analytics tab)
**Fix:**
1. Create `/api/analytics` endpoint
2. For Twitter: use Twitter API v2 `GET /2/tweets` with tweet.fields=public_metrics
3. For LinkedIn: use LinkedIn API `GET /socialActions/{urn}/` for stats
4. For Bluesky: use `app.bsky.feed.getPostThread` for like/repost counts
5. Cache metrics in `PlatformPost` table (likesCount, commentsCount, sharesCount, impressions)
6. Add a "Sync Metrics" button + auto-sync on analytics tab load

### Fix 7: Calendar — Show Scheduled + Published Posts
**Problem:** Calendar only reads from `recentPosts` (localStorage). No DB integration.
**File:** `src/app/page.tsx` lines 914-979
**Fix:**
1. Fetch from `GET /api/schedule` on calendar tab mount
2. Show scheduled posts in blue, published in green, failed in red
3. Click on a day → show posts for that day
4. Click on a post → option to edit/cancel (if scheduled)

### Fix 8: Thread/Multi-Post Support
**Problem:** No way to create Twitter threads or LinkedIn carousels.
**File:** `src/app/page.tsx` (compose tab)
**Fix:**
1. Add "Thread Mode" toggle in compose
2. Show numbered text areas (slide 1, slide 2, etc.) with + button
3. Twitter: post as reply chain
4. LinkedIn: post as article or carousel (PDF upload)
5. Bluesky: post as thread (reply chain)

---

## PHASE 3: Enhancements (Competitive Edge)

### Fix 9: Content Queue / Drafts
**Problem:** No way to save a draft without publishing or scheduling. Close the tab = lose content.
**Fix:**
1. Add "Save Draft" button in compose
2. Store drafts in DB with status=DRAFT
3. Show drafts list in History tab (filter by status)
4. Auto-save draft every 30 seconds while typing

### Fix 10: Platform-Specific Content Overrides
**Problem:** Same content goes to all platforms. Twitter has 280 chars, LinkedIn has 3000.
**Fix:**
1. After composing main content, show platform-specific preview tabs
2. Allow editing per-platform (e.g., shorter for Twitter, longer for LinkedIn)
3. Store per-platform content in `PlatformPost.content` field

### Fix 11: Team/Multi-User Support
**Problem:** Schema has User, Workspace, WorkspaceMember tables but they're unused.
**Fix:**
1. Add login (OAuth with Google or email magic link)
2. Create default workspace on first login
3. Scope all posts/profiles to workspace
4. Role-based access (ADMIN can manage accounts, EDITOR can compose/publish)

### Fix 12: Webhook/Notification on Publish
**Problem:** No feedback after scheduled posts fire. Did it work? Did it fail?
**Fix:**
1. After cron publishes, send notification via OpenClaw webhook or email
2. Log failures to PlatformPost.errorLog
3. Add "Retry Failed" button in history

---

## PHASE 4: Logo & Branding

### Fix 13: Parallax Publish Logo
**Problem:** Currently using the generic Parallax logo (`parallax-logo.jpg` 479x590). Needs a Publish-specific logo that's based on the Parallax brand.
**Approach:**
1. Read the Parallax brand identity (check brand-analyzer profiles if available)
2. Generate a "Parallax Publish" logo variant:
   - Same base Parallax logo mark/icon
   - Add "Publish" wordmark in brand gradient (#1a1a5e → #7c3aed)
   - Icon concept: Parallax logo with a "send/broadcast" motif (paper plane, broadcast waves, or arrow emerging)
3. Generate in SVG (scalable) + PNG (32x32, 192x192, 512x512) for favicon/PWA
4. Replace `public/parallax-logo.jpg` and update `page.tsx` header
5. Update `public/manifest.json` icons
6. Update `public/favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`

---

## IMPLEMENTATION ORDER (for Cursor)

**Round 1 (Critical — do these first):**
1. Fix 1: SQLite → Turso migration
2. Fix 3: Persist connected accounts to DB
3. Fix 5: Post history from DB
4. Fix 2: Cron actually publishes

**Round 2 (Usable product):**
5. Fix 4: Media upload to Vercel Blob
6. Fix 6: Real analytics data
7. Fix 7: Calendar DB integration
8. Fix 9: Drafts/auto-save

**Round 3 (Competitive):**
9. Fix 8: Thread support
10. Fix 10: Per-platform content
11. Fix 12: Publish notifications

**Round 4 (Polish):**
12. Fix 11: Multi-user/workspace
13. Fix 13: Logo generation

---

## ENV VARS NEEDED

```env
# Database (Turso)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# Twitter OAuth2
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
TWITTER_CALLBACK_URL=https://parallax-publish.vercel.app/api/auth/twitter/callback

# LinkedIn OAuth2
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_CALLBACK_URL=https://parallax-publish.vercel.app/api/auth/linkedin/callback

# Instagram (Facebook Developer)
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=

# Bluesky (stored per-user, no env vars needed)

# AI Writer
GEMINI_API_KEY=

# Scheduled publishing
CRON_SECRET=

# Media Storage (Vercel Blob)
BLOB_READ_WRITE_TOKEN=
```

---

## CURRENT STATE SUMMARY

| Feature | Status | Issue |
|---------|--------|-------|
| Compose + Publish | WORKS | But accounts reset on refresh |
| Twitter posting | WORKS | Via OAuth cookie (not persisted) |
| LinkedIn posting | WORKS | Via OAuth cookie (not persisted) |
| Bluesky posting | WORKS | Via client-side credentials |
| Instagram | BLOCKED | Facebook Developer Portal permissions |
| Scheduling | BROKEN | DB returns null on Vercel (SQLite) |
| Cron publish | BROKEN | Marks as published but doesn't actually post |
| Post history | PARTIAL | localStorage only, no DB |
| Analytics | PLACEHOLDER | Only counts from localStorage |
| Calendar | PARTIAL | Shows localStorage posts only |
| AI Writer | WORKS | Gemini API with template fallback |
| Media upload | LOCAL ONLY | Filesystem, not persisted on Vercel |
| Drafts | MISSING | No save draft feature |
| Threads | MISSING | No multi-post support |
| Per-platform content | MISSING | Same text everywhere |
| Logo | GENERIC | Uses main Parallax logo |
