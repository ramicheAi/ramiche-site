'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function GuidePage() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="border-2 border-[#a855f7]/25 rounded-2xl bg-[#0a0a1a] overflow-hidden">
      <button
        onClick={() => toggleSection(id)}
        className="w-full p-8 flex justify-between items-center hover:bg-[#a855f7]/10 transition-colors min-h-[44px]"
      >
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <span className="text-3xl text-[#a855f7]">{openSections[id] ? '−' : '+'}</span>
      </button>
      {openSections[id] && (
        <div className="p-8 pt-0 border-t border-white/10">
          {children}
        </div>
      )}
    </div>
  )

  const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6 last:mb-0">
      <h3 className="text-xl font-bold text-[#a855f7] mb-3">{title}</h3>
      <div className="text-gray-300 leading-relaxed space-y-2">{children}</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a1a] p-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Link
            href="/apex-athlete"
            className="inline-block px-6 py-3 border-2 border-[#a855f7]/25 rounded-xl text-[#a855f7] font-bold hover:bg-[#a855f7]/10 transition-colors min-h-[44px]"
          >
            ← Back to METTLE
          </Link>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">How to Use METTLE</h1>
          <p className="text-xl text-gray-400">The complete guide to the athlete management platform</p>
        </div>

        <div className="space-y-12">
          <Section id="getting-started" title="Getting Started">
            <SubSection title="Setting Up Your Team (Coaches)">
              <p>To get started with METTLE, coaches need to create their organization and set up their roster.</p>
              <ol className="list-decimal list-inside space-y-2 mt-2">
                <li><strong>Create your organization</strong> — Enter your team or club name during first-time setup</li>
                <li><strong>Add athletes</strong> — Build your roster by entering athlete names, ages, and events</li>
                <li><strong>Set PINs</strong> — Each coach gets a 6-digit PIN for secure portal access. Athletes and parents select their name from a dropdown.</li>
              </ol>
            </SubSection>
            <SubSection title="Three Portals">
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-[#a855f7]">Coach Portal:</strong> Full management access — roster, meets, analytics, quests, shoutouts</li>
                <li><strong className="text-[#a855f7]">Athlete Portal:</strong> Personal dashboard — stats, levels, streaks, XP progress</li>
                <li><strong className="text-emerald-400">Parent Portal:</strong> Read-only view of your child&apos;s progress and achievements</li>
              </ul>
            </SubSection>
          </Section>

          <Section id="coach-portal" title="Coach Portal">
            <SubSection title="Roster Management">
              <p>View and manage your complete athlete roster. Each athlete card shows their current level, XP progress, active streak, and total training sessions. Use quick action buttons to award XP on the spot.</p>
            </SubSection>
            <SubSection title="Meet Management">
              <p>Create and manage competitive meets. Import results from Hy-Tek files, assign heat and lane numbers, and record finish times. Meet results automatically award XP based on performance.</p>
            </SubSection>
            <SubSection title="Analytics Dashboard">
              <p>Track team-wide trends including attendance rates, average XP earned, streak distributions, and level progression curves. Identify athletes who need extra motivation or recognition.</p>
            </SubSection>
            <SubSection title="Quests & Challenges">
              <p>Create custom challenges for your athletes. Quests can target the whole team or individual athletes, with custom XP rewards upon completion. Set deadlines, add descriptions, and track progress.</p>
            </SubSection>
            <SubSection title="Shoutouts">
              <p>Publicly recognize athlete achievements. Shoutouts appear on the athlete&apos;s dashboard and parent portal, reinforcing positive behavior and effort.</p>
            </SubSection>
          </Section>

          <Section id="athlete-portal" title="Athlete Portal">
            <SubSection title="Logging In">
              <p>Athletes select their name from the roster dropdown — no PIN required. Your personal dashboard loads immediately with all your stats and progress.</p>
            </SubSection>
            <SubSection title="Dashboard Overview">
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Level & XP Bar:</strong> Visual progress toward your next level</li>
                <li><strong>Active Streak:</strong> Consecutive training sessions attended</li>
                <li><strong>Total Sessions:</strong> Lifetime attendance count</li>
                <li><strong>Recent XP Gains:</strong> Latest achievements and awards</li>
              </ul>
            </SubSection>
            <SubSection title="Level Progression">
              <p>Earn XP through attendance, meet results, quest completion, and coach awards. As XP accumulates, you advance through levels — each unlocking new badges and recognition.</p>
            </SubSection>
            <SubSection title="Streak Tracking">
              <p>Build momentum with consecutive attendance. Longer streaks earn XP multipliers. Missing a session breaks your streak, so consistency matters more than intensity.</p>
            </SubSection>
          </Section>

          <Section id="parent-portal" title="Parent Portal">
            <SubSection title="Accessing Your Child's Data">
              <p>Select your athlete&apos;s name from the dropdown. The parent portal is read-only — you can view all stats but cannot modify anything. Data updates in real-time as coaches record sessions and meets.</p>
            </SubSection>
            <SubSection title="What You Can See">
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Level progression</strong> over time</li>
                <li><strong>Attendance consistency</strong> and streak history</li>
                <li><strong>XP earnings</strong> breakdown by activity type</li>
                <li><strong>Quest completion</strong> status and progress</li>
                <li><strong>Meet results</strong> and competitive achievements</li>
                <li><strong>Coach shoutouts</strong> and recognition</li>
              </ul>
            </SubSection>
            <SubSection title="Communication">
              <p>View coach notes and announcements. Stay informed about upcoming meets, schedule changes, and team events.</p>
            </SubSection>
          </Section>

          <Section id="level-system" title="Level System">
            <SubSection title="Progression Tiers">
              <p>Athletes advance through six levels by earning XP. Each level represents a higher tier of commitment and achievement.</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                  <span className="text-2xl">🥉</span>
                  <div>
                    <p className="font-bold text-white">Rookie</p>
                    <p className="text-sm">0 XP — Starting tier. Every athlete begins here.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                  <span className="text-2xl">🥈</span>
                  <div>
                    <p className="font-bold text-white">Contender</p>
                    <p className="text-sm">300 XP — Showing up and putting in work.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                  <span className="text-2xl">⚔️</span>
                  <div>
                    <p className="font-bold text-white">Warrior</p>
                    <p className="text-sm">600 XP — Consistent effort and improving performance.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                  <span className="text-2xl">💎</span>
                  <div>
                    <p className="font-bold text-white">Elite</p>
                    <p className="text-sm">1,000 XP — Standing out from the pack.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                  <span className="text-2xl">👑</span>
                  <div>
                    <p className="font-bold text-white">Captain</p>
                    <p className="text-sm">1,500 XP — Leadership tier. Setting the standard.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <p className="font-bold text-white">Legend</p>
                    <p className="text-sm">2,500 XP — The highest honor. Earned through sustained excellence.</p>
                  </div>
                </div>
              </div>
            </SubSection>
            <SubSection title="Earning XP">
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Attendance:</strong> Base XP for showing up to practice</li>
                <li><strong>Meet results:</strong> Bonus XP for competitive performance and PRs</li>
                <li><strong>Quest completion:</strong> Custom XP set by coaches</li>
                <li><strong>Coach awards:</strong> +10, +25, +50, or +100 XP for effort and achievement</li>
                <li><strong>Streak multiplier:</strong> Longer streaks boost all XP earned</li>
              </ul>
            </SubSection>
          </Section>

          <Section id="meet-management" title="Meet Management">
            <SubSection title="Creating a Meet">
              <p>Coaches create meets by entering the meet name, date, location, and event list. Athletes are then assigned to their events with heat and lane numbers.</p>
            </SubSection>
            <SubSection title="Importing Hy-Tek Files">
              <p>METTLE supports importing meet results from Hy-Tek timing system exports. Upload the results file and METTLE automatically matches athletes, records times, and awards XP based on performance.</p>
            </SubSection>
            <SubSection title="Heat & Lane Assignment">
              <p>Assign athletes to heats and lanes for each event. The system tracks seeding times and can auto-seed based on previous results or manual entry.</p>
            </SubSection>
            <SubSection title="Recording Results">
              <p>Enter finish times, places, and notes for each athlete per event. Personal records (PRs) are automatically detected and highlighted. Meet results feed into XP calculations and the analytics dashboard.</p>
            </SubSection>
          </Section>

          <Section id="quests" title="Quests & Goals">
            <SubSection title="How Quests Work">
              <p>Coaches create quests — targeted challenges with specific objectives and XP rewards. Quests drive engagement between meets and encourage athletes to focus on improvement areas.</p>
            </SubSection>
            <SubSection title="Group Quests">
              <p>Team-wide challenges that everyone works toward together. Examples: &quot;Team attends 50 total sessions this month&quot; or &quot;Every athlete hits a PR this season.&quot; Group quests build team cohesion.</p>
            </SubSection>
            <SubSection title="Individual Quests">
              <p>Personalized goals assigned to specific athletes. Examples: &quot;Drop your 100m time by 0.3 seconds&quot; or &quot;Attend 10 consecutive sessions.&quot; Individual quests address each athlete&apos;s growth areas.</p>
            </SubSection>
            <SubSection title="Quest Rewards">
              <p>Coaches set custom XP rewards for each quest. Harder quests should offer more XP. Completed quests appear as achievements on the athlete&apos;s profile and parent portal.</p>
            </SubSection>
          </Section>

          <Section id="faq" title="FAQ">
            <SubSection title="How do I reset my PIN?">
              <p>Coaches can reset their PIN through the organization settings. Contact your team administrator if you&apos;re locked out. Athletes and parents don&apos;t use PINs — they select their name from the roster.</p>
            </SubSection>
            <SubSection title="How are times tracked?">
              <p>Times are entered manually by coaches after meets, or imported automatically from Hy-Tek timing system files. METTLE stores all times and automatically detects personal records.</p>
            </SubSection>
            <SubSection title="Can I use METTLE on my phone?">
              <p>Yes. METTLE is fully responsive and works on any device with a web browser. All three portals are optimized for mobile screens with touch-friendly targets.</p>
            </SubSection>
            <SubSection title="What happens if an athlete misses a session?">
              <p>Their active streak resets to zero. They keep all earned XP and their level — only the streak multiplier resets. Encourage consistent attendance to maintain streak bonuses.</p>
            </SubSection>
            <SubSection title="Can parents edit anything?">
              <p>No. The parent portal is completely read-only. Only coaches can modify data, award XP, or manage the roster. This ensures data integrity.</p>
            </SubSection>
            <SubSection title="How do I add a new athlete mid-season?">
              <p>Coaches can add athletes at any time from the Roster tab. New athletes start at Rookie (0 XP) regardless of when they join. Their progress is tracked from their first recorded session.</p>
            </SubSection>
          </Section>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/apex-athlete"
            className="inline-block px-8 py-4 border-2 border-[#a855f7] bg-[#a855f7] rounded-xl text-white font-bold text-lg hover:bg-[#a855f7]/80 transition-colors min-h-[44px]"
          >
            START YOUR JOURNEY
          </Link>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>METTLE &copy; 2026</p>
        </div>
      </div>
    </div>
  )
}
