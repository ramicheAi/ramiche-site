# SkillsBench Analysis — Feb 24, 2026

Source: "SkillsBench: Benchmarking How Well Agent Skills Work Across Diverse Tasks" (arXiv:2602.12670)
Context: Theo (t3.gg) tweeted "You should delete your CLAUDE.md/AGENTS.md file. I have a study to prove it." — 6.9K likes, 463 retweets.

## The Study

- 86 tasks across 11 domains, 7,308 trajectories, 7 agent-model configurations
- Tested curated skills, self-generated skills, and no skills
- Biggest benchmark of agent skills to date

## Key Findings

### 1. Curated skills DO help (+16.2pp average)
- Healthcare: +51.9pp (massive)
- Most domains: meaningful improvement
- Software Engineering: only +4.5pp (weakest)

### 2. Self-generated skills DON'T help (-1.3pp average)
- Models CANNOT write their own effective procedures
- LLMs' internal knowledge ≠ effective procedural documentation
- **This is Theo's argument:** if you let Claude write your CLAUDE.md, it won't help

### 3. 16 of 84 tasks HURT by skills
- Not universal — some tasks perform worse with skills
- Irrelevant procedural knowledge can confuse the model

### 4. Focused > Comprehensive
- **2-3 modules per skill is optimal**
- Less is more — targeted beats encyclopedic
- Bloated docs hurt more than they help

### 5. Skills substitute for model scale
- Claude Haiku 4.5 + skills (27.7%) > Claude Opus 4.5 without skills (22.0%)
- Cheaper models + good skills = same output as expensive models

## What Theo Gets WRONG

Theo's hot take "delete your CLAUDE.md" is clickbait that misreads the paper:

1. **The paper proves curated skills help by +16.2pp.** That's not "delete your files" — that's "make them better."
2. **The finding about SELF-GENERATED skills failing is the real insight.** If you asked Claude to write its own CLAUDE.md, yes, delete that. But if a HUMAN curated the skills based on real experience, that's the +16.2pp version.
3. **Our SOUL.md and AGENTS.md are human-curated, experience-based, battle-tested.** They're not self-generated fluff. They encode real lessons from real failures. That's exactly the "curated skills" that the paper proves work.

## What We Should CHANGE Based on This

### 1. TRIM our files (2-3 modules per skill is optimal)
- SOUL.md is 280+ lines — that's too long
- AGENTS.md is also long
- **Action:** Distill each to the essential 2-3 modules. Move everything else to linked reference files.

### 2. STOP self-generating agent docs
- Don't let agents write their own soul files or skill docs
- Human curation (Ramon + Atlas) is the +16.2pp version
- Self-generated = -1.3pp version

### 3. VERIFY skills per domain
- 16/84 tasks hurt by skills — we need to check if any of our agent skills are actually hurting specific tasks
- Especially for software engineering (+4.5pp only) — our coding agent instructions should be minimal
- Healthcare/coaching/analytics skills should be comprehensive (that's where the biggest gains are)

### 4. USE skills for cost savings
- Haiku + curated skills > Opus without skills
- We can run MORE agents on cheaper models if we have excellent skill files
- This directly addresses our OpenRouter budget issue ($142.91/$150)

### 5. STRUCTURE skills consistently
- Each skill should have exactly 2-3 focused modules
- Module 1: Context (what this agent does, when to use it)
- Module 2: Procedures (step-by-step, battle-tested workflows)
- Module 3: Constraints (what NOT to do, verified failure modes)
- Nothing else. No fluff.

## Impact on Our Ecosystem

### ClawHub Skills (SELLING these)
This paper is GOLD for our marketplace. We sell CURATED skills — the exact thing the paper proves works (+16.2pp). Our marketing should cite this study:
- "Research proves curated agent skills improve performance by 16.2%"
- "Don't write your own — use battle-tested, curated skills from experts"
- "Skills are cheaper than upgrading your model (Haiku + skills > Opus)"

### METTLE
- Coach portal skills (scheduling, analytics, meet management) — should be focused, 2-3 modules each
- The gamification engine documentation should be concise, not encyclopedic

### OpenClaw
- Every skill in our marketplace should follow the 2-3 module structure
- Quality bar: each skill must demonstrate measurable improvement on its target task
- Self-generated skills should be labeled as such (or better: prohibited from the marketplace)

## Response to Theo's Tweet

Draft reply for X (@PARALLAXVINC):
"The paper actually proves curated skills improve agent performance by +16.2pp. What doesn't work: letting the model write its own skills (-1.3pp). The insight isn't 'delete your files' — it's 'don't let AI write its own instructions.' Human-curated, battle-tested skills = the version that works. We sell those at clawhub.com."
