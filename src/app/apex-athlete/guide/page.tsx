'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function GuidePage() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="border-2 border-[#D4A843] bg-[#0A0814] overflow-hidden">
      <button
        onClick={() => toggleSection(id)}
        className="w-full p-6 flex justify-between items-center hover:bg-[#7C3AED]/10 transition-colors"
      >
        <h2 className="text-2xl font-bold text-[#D4A843]">{title}</h2>
        <span className="text-3xl text-[#D4A843]">{openSections[id] ? '−' : '+'}</span>
      </button>
      {openSections[id] && (
        <div className="p-6 pt-0 border-t-2 border-[#D4A843]/30">
          {children}
        </div>
      )}
    </div>
  )

  const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6 last:mb-0">
      <h3 className="text-xl font-bold text-[#7C3AED] mb-3">{title}</h3>
      <div className="text-white/80 space-y-2">{children}</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#060410] p-10">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Link
            href="/apex-athlete/landing"
            className="inline-block px-6 py-3 border-2 border-[#D4A843] text-[#D4A843] font-bold hover:bg-[#D4A843] hover:text-[#060410] transition-colors"
          >
            ← BACK TO METTLE
          </Link>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-[#D4A843] mb-4">METTLE USER GUIDE</h1>
          <p className="text-xl text-white/60">Master the ultimate athlete tracking system</p>
        </div>

        <div className="space-y-8">
          <Section id="getting-started" title="🎮 GETTING STARTED">
            <SubSection title="What is METTLE?">
              <p>METTLE is a gamified athlete management platform that transforms training into an epic quest. Athletes earn XP, level up, complete challenges, and compete in a game-like environment while coaches track real progress.</p>
            </SubSection>
            <SubSection title="Three Portals">
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-[#D4A843]">Coach Portal:</strong> Manage rosters, track attendance, award XP, create quests</li>
                <li><strong className="text-[#7C3AED]">Athlete Portal:</strong> View dashboard, track levels, maintain streaks, complete checkpoints</li>
                <li><strong className="text-emerald-400">Parent Portal:</strong> Monitor your athlete's progress and achievements</li>
              </ul>
            </SubSection>
            <SubSection title="Quick Start">
              <p className="mb-2">1. Choose your portal from the landing page</p>
              <p className="mb-2">2. Coaches enter PIN → Athletes/Parents select name</p>
              <p>3. Start tracking, leveling up, and crushing goals!</p>
            </SubSection>
          </Section>

          <Section id="coach-portal" title="🏆 COACH PORTAL">
            <SubSection title="PIN Login">
              <p>Enter your 6-digit coach PIN on the login screen. This grants access to all coach management features.</p>
            </SubSection>
            <SubSection title="Roster Management">
              <p className="mb-2">View and manage your complete athlete roster. Each athlete card displays:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Current level and XP progress</li>
                <li>Active streak count</li>
                <li>Total training sessions</li>
                <li>Quick action buttons for XP awards</li>
              </ul>
            </SubSection>
            <SubSection title="Attendance Tracking">
              <p className="mb-2">Mark athletes present at training sessions. Present athletes automatically:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Earn base XP for the session</li>
                <li>Extend their active streak</li>
                <li>Get counted toward checkpoint progress</li>
              </ul>
            </SubSection>
            <SubSection title="XP System">
              <p className="mb-2">Award experience points for achievements:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>+10 XP:</strong> Attendance bonus</li>
                <li><strong>+25 XP:</strong> Good effort or improvement</li>
                <li><strong>+50 XP:</strong> Outstanding performance</li>
                <li><strong>+100 XP:</strong> Major achievement or breakthrough</li>
              </ul>
              <p className="mt-2">XP accumulates toward levels. Each level requires progressively more XP.</p>
            </SubSection>
            <SubSection title="Meets & Competitions">
              <p className="mb-2">Log meet results and award bonus XP for competitive performance. Track PRs and podium finishes.</p>
            </SubSection>
            <SubSection title="Quest System">
              <p>Create custom challenges and goals for athletes. Quests can be individual or team-wide, with custom XP rewards upon completion.</p>
            </SubSection>
          </Section>

          <Section id="athlete-portal" title="⚡ ATHLETE PORTAL">
            <SubSection title="Dashboard Overview">
              <p className="mb-2">Your command center displays:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-[#D4A843]">Current Level & XP Bar:</strong> Visual progress to next level</li>
                <li><strong className="text-orange-400">Active Streak:</strong> Consecutive training sessions</li>
                <li><strong className="text-[#7C3AED]">Total Sessions:</strong> Lifetime attendance count</li>
                <li><strong className="text-emerald-400">Recent XP Gains:</strong> Latest achievements</li>
              </ul>
            </SubSection>
            <SubSection title="Level System">
              <p className="mb-2">Advance through levels by earning XP. Higher levels unlock:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>New profile badges and titles</li>
                <li>Access to advanced quests</li>
                <li>Leadership opportunities</li>
                <li>Special recognition from coaches</li>
              </ul>
              <p className="mt-2">Each level requires: <strong className="text-[#D4A843]">100 × (current level)</strong> XP</p>
            </SubSection>
            <SubSection title="Streak Tracking">
              <p className="mb-2">Build momentum with consecutive attendance:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>🔥 <strong>7-day streak:</strong> Bronze tier (+5% XP bonus)</li>
                <li>🔥🔥 <strong>14-day streak:</strong> Silver tier (+10% XP bonus)</li>
                <li>🔥🔥🔥 <strong>30-day streak:</strong> Gold tier (+20% XP bonus)</li>
              </ul>
              <p className="mt-2 text-orange-400">Missing a session breaks your streak!</p>
            </SubSection>
            <SubSection title="Checkpoints & Milestones">
              <p className="mb-2">Reach major milestones for massive XP rewards:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>10 sessions → +50 XP</li>
                <li>25 sessions → +150 XP</li>
                <li>50 sessions → +300 XP</li>
                <li>100 sessions → +1000 XP + Legendary Badge</li>
              </ul>
            </SubSection>
          </Section>

          <Section id="parent-portal" title="👨‍👩‍👧 PARENT PORTAL">
            <SubSection title="Viewing Progress">
              <p>Select your athlete's name to access their complete profile. View all stats in real-time as your athlete trains and competes.</p>
            </SubSection>
            <SubSection title="Performance Reports">
              <p className="mb-2">Track your athlete's journey:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Level progression</strong> over time</li>
                <li><strong>Attendance consistency</strong> and streak history</li>
                <li><strong>XP earnings</strong> breakdown by activity</li>
                <li><strong>Quest completion</strong> status</li>
                <li><strong>Meet results</strong> and competitive achievements</li>
              </ul>
            </SubSection>
            <SubSection title="Engagement Insights">
              <p>See how your athlete compares to team averages (anonymized). Identify trends in motivation, consistency, and improvement areas.</p>
            </SubSection>
            <SubSection title="Communication">
              <p>View coach notes and announcements. Stay informed about upcoming meets, special training sessions, and team events.</p>
            </SubSection>
          </Section>

          <Section id="tips" title="💡 PRO TIPS">
            <SubSection title="For Coaches">
              <ul className="list-disc list-inside space-y-2">
                <li>Award XP immediately after achievements for maximum motivation</li>
                <li>Create weekly quests to maintain engagement between meets</li>
                <li>Celebrate streaks publicly to encourage consistency</li>
                <li>Use the +100 XP bonus sparingly to preserve its impact</li>
              </ul>
            </SubSection>
            <SubSection title="For Athletes">
              <ul className="list-disc list-inside space-y-2">
                <li>Check your dashboard before each session to set daily goals</li>
                <li>Protect your streak at all costs—consistency {'>'} intensity</li>
                <li>Aim for checkpoints to unlock massive XP rewards</li>
                <li>Complete quests for bonus XP and special recognition</li>
              </ul>
            </SubSection>
            <SubSection title="For Parents">
              <ul className="list-disc list-inside space-y-2">
                <li>Check progress weekly to celebrate wins with your athlete</li>
                <li>Use streak data to encourage consistent attendance</li>
                <li>Discuss XP trends to identify what motivates your athlete</li>
                <li>Reference milestones to set achievable long-term goals</li>
              </ul>
            </SubSection>
          </Section>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/apex-athlete/landing"
            className="inline-block px-8 py-4 border-2 border-[#7C3AED] bg-[#7C3AED] text-white font-bold text-lg hover:bg-[#7C3AED]/80 transition-colors"
          >
            START YOUR JOURNEY
          </Link>
        </div>

        <div className="mt-8 text-center text-white/40 text-sm">
          <p>METTLE © 2026 | Level up your game</p>
        </div>
      </div>
    </div>
  )
}
