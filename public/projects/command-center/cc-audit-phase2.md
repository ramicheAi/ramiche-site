Fix these issues in order. After each fix, run `npx eslint` on the changed file to verify. Commit after each successful fix with --no-verify.

## Task 1: Fix lint errors (FIRST)
Run `npx eslint src/app/command-center/ --max-warnings 200` to find all errors. Fix the 10 errors:
- `no-explicit-any`: Replace `any` with proper types
- `set-state-in-effect`: Wrap setState calls properly

## Task 2: Nerve Center (already restored to original design)
The file at `src/app/command-center/yolo/nerve-center/page.tsx` has been restored to the original experiment log design. Remove the unused `Suspense` import. Wire the EXPERIMENTS data to fetch from `/api/command-center/yolo-builds` but keep the original UI layout (green/black hacker aesthetic, experiment cards with ID, name, status, delta). Map YOLO build data into the experiment format.

## Task 3: Activity feed
`src/app/command-center/activity/page.tsx` has 12 hardcoded events. Create `/api/command-center/activity/route.ts` that reads from git log (`git log --oneline -30 /Users/admin/ramiche-site`) to build real activity. Wire the page to fetch from it.

## Task 4: Office agent models
`src/app/command-center/office/page.tsx` has wrong models. Update FALLBACK_AGENTS to match:
- Atlas: Opus 4.6
- SHURI, NOVA, TRIAGE, SIMONS, MERCURY, Dr Strange, HAVEN, INK, KIYOSAKI: Sonnet 4.5
- AETHERION: Gemini 3.1 Pro
- VEE, PROPHETS: Kimi K2.5
- ECHO, MICHAEL, WIDOW, TheMAESTRO, SELAH: qwen3:14b
- THEMIS: Sonnet 4.5

Commit each fix separately with --no-verify.
