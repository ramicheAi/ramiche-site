"use client";

import Link from "next/link";

// Mock data for demo
const mockAthletes = [
  { name: "Sarah Johnson", level: "Captain", levelNum: 5, xp: 4200, maxXP: 5000, avatar: "🏃‍♀️" },
  { name: "Marcus Chen", level: "Elite", levelNum: 4, xp: 2800, maxXP: 3500, avatar: "⚡" },
  { name: "Emma Rodriguez", level: "Warrior", levelNum: 3, xp: 1600, maxXP: 2000, avatar: "🔥" },
  { name: "Tyler Williams", level: "Warrior", levelNum: 3, xp: 1200, maxXP: 2000, avatar: "💪" },
  { name: "Olivia Brown", level: "Contender", levelNum: 2, xp: 850, maxXP: 1200, avatar: "⭐" },
  { name: "Jamal Davis", level: "Contender", levelNum: 2, xp: 950, maxXP: 1200, avatar: "🎯" },
  { name: "Sophia Martinez", level: "Rookie", levelNum: 1, xp: 320, maxXP: 600, avatar: "🌟" },
  { name: "Liam Anderson", level: "Rookie", levelNum: 1, xp: 480, maxXP: 600, avatar: "🚀" },
];

const mockQuests = [
  { title: "Break 60 seconds in 100m Free", progress: 65, total: 100, participants: 12 },
  { title: "Complete 10,000m this week", progress: 7200, total: 10000, participants: 8 },
  { title: "Perfect attendance for March", progress: 18, total: 22, participants: 15 },
];

const mockShoutouts = [
  { athlete: "Sarah Johnson", coach: "Coach Martinez", message: "Incredible 200 IM today! That's a 5-second PR!", time: "2 hours ago" },
  { athlete: "Marcus Chen", coach: "Coach Martinez", message: "Leadership on display - great job helping the rookies with starts!", time: "5 hours ago" },
];

const features = [
  { icon: "📊", title: "Level System", desc: "Gamified progression from Rookie to Legend keeps athletes motivated" },
  { icon: "🏊", title: "Meet Management", desc: "Import Hy-Tek files, assign heats/lanes, record results seamlessly" },
  { icon: "🎯", title: "Quests & Goals", desc: "Set team-wide or individual goals with real-time progress tracking" },
  { icon: "📣", title: "Shoutouts", desc: "Celebrate wins and build culture with public recognition" },
  { icon: "📈", title: "Analytics", desc: "Track performance trends, attendance, and team metrics" },
  { icon: "🎨", title: "White-Label", desc: "Fully customizable with your team's branding and colors" },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Back link */}
      <div className="border-b border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/apex-athlete" className="text-[#a855f7] hover:text-[#a855f7]/80 transition-colors">
            ← Back to METTLE
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="border-b border-white/10 bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2a] to-[#0a0a1a]">
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-[#a855f7] via-[#d946ef] to-[#a855f7] bg-clip-text text-transparent">
            METTLE Demo
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            See how METTLE transforms your program
          </p>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
            A complete athlete development platform with gamification, meet management, and parent engagement — all in one place.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-16 space-y-16">
        {/* Coach Dashboard Preview */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-white">Coach Dashboard Preview</h2>

          {/* Team Roster */}
          <div className="border-2 border-[#a855f7]/25 rounded-2xl p-8 bg-black/20">
            <h3 className="text-2xl font-bold text-white mb-6">Team Roster</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {mockAthletes.map((athlete, i) => (
                <div
                  key={i}
                  className="border border-[#a855f7]/20 rounded-xl p-4 bg-[#0a0a1a]/50"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-3xl">{athlete.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{athlete.name}</div>
                      <div className="text-sm text-[#a855f7]">{athlete.level}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>XP Progress</span>
                      <span>{athlete.xp} / {athlete.maxXP}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#a855f7] to-[#d946ef]"
                        style={{ width: `${(athlete.xp / athlete.maxXP) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quest Board */}
          <div className="border-2 border-[#a855f7]/25 rounded-2xl p-8 bg-black/20">
            <h3 className="text-2xl font-bold text-white mb-6">Active Quests</h3>
            <div className="space-y-4">
              {mockQuests.map((quest, i) => (
                <div
                  key={i}
                  className="border border-[#a855f7]/20 rounded-xl p-5 bg-[#0a0a1a]/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-white">{quest.title}</h4>
                    <span className="text-sm text-gray-400">{quest.participants} athletes</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Progress</span>
                      <span>{quest.progress} / {quest.total}</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#a855f7] to-[#d946ef]"
                        style={{ width: `${(quest.progress / quest.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shoutout Feed */}
          <div className="border-2 border-[#a855f7]/25 rounded-2xl p-8 bg-black/20">
            <h3 className="text-2xl font-bold text-white mb-6">Recent Shoutouts</h3>
            <div className="space-y-4">
              {mockShoutouts.map((shoutout, i) => (
                <div
                  key={i}
                  className="border-l-4 border-[#a855f7] pl-4 py-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-white">{shoutout.athlete}</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-sm text-gray-400">{shoutout.time}</span>
                  </div>
                  <p className="text-gray-300">{shoutout.message}</p>
                  <p className="text-sm text-gray-500 mt-1">— {shoutout.coach}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Athlete View Preview */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-white">Athlete View Preview</h2>
          <div className="border-2 border-[#a855f7]/25 rounded-2xl p-8 bg-black/20">
            <div className="max-w-2xl mx-auto space-y-8">
              {/* Level Badge */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-4 border-[#a855f7] bg-gradient-to-br from-[#a855f7]/20 to-[#d946ef]/20 mb-4">
                  <div>
                    <div className="text-4xl font-bold text-white">3</div>
                    <div className="text-sm text-[#a855f7]">Warrior</div>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Sarah Johnson</h3>
                <p className="text-gray-400">4,200 / 5,000 XP to Captain</p>
              </div>

              {/* XP Progress */}
              <div className="space-y-3">
                <div className="h-6 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#a855f7] to-[#d946ef] flex items-center justify-end pr-3"
                    style={{ width: "84%" }}
                  >
                    <span className="text-xs font-bold text-white">84%</span>
                  </div>
                </div>
              </div>

              {/* Recent Times */}
              <div className="border-t border-white/10 pt-6">
                <h4 className="font-semibold text-white mb-4">Recent Times</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">100m Freestyle</span>
                    <span className="font-semibold text-[#a855f7]">58.42s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">200m IM</span>
                    <span className="font-semibold text-[#a855f7]">2:18.67</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">50m Butterfly</span>
                    <span className="font-semibold text-[#a855f7]">28.91s</span>
                  </div>
                </div>
              </div>

              {/* Active Quests */}
              <div className="border-t border-white/10 pt-6">
                <h4 className="font-semibold text-white mb-4">My Active Quests</h4>
                <div className="space-y-3">
                  <div className="border border-[#a855f7]/20 rounded-lg p-3 bg-[#0a0a1a]/50">
                    <div className="font-medium text-white mb-2">Break 60 seconds in 100m Free</div>
                    <div className="text-sm text-gray-400 mb-2">Current: 58.42s ✅</div>
                    <div className="text-xs text-[#a855f7]">Quest Complete! +500 XP</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Parent View Preview */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-white">Parent View Preview</h2>
          <div className="border-2 border-[#a855f7]/25 rounded-2xl p-8 bg-black/20">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center pb-6 border-b border-white/10">
                <h3 className="text-2xl font-bold text-white mb-2">Sarah Johnson's Progress</h3>
                <p className="text-gray-400">Level 3 Warrior • 4,200 XP</p>
              </div>

              <div className="space-y-4">
                <div className="border border-[#a855f7]/20 rounded-lg p-5 bg-[#0a0a1a]/50">
                  <h4 className="font-semibold text-white mb-3">Recent Achievements</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-[#a855f7]">🏆</span>
                      <span>Completed "Break 60s in 100m Free" quest</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#a855f7]">⭐</span>
                      <span>Perfect attendance for February</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#a855f7]">📈</span>
                      <span>Personal best in 200m IM (2:18.67)</span>
                    </li>
                  </ul>
                </div>

                <div className="border border-[#a855f7]/20 rounded-lg p-5 bg-[#0a0a1a]/50">
                  <h4 className="font-semibold text-white mb-3">Coach Communication</h4>
                  <div className="space-y-3">
                    <div className="border-l-4 border-[#a855f7] pl-3">
                      <p className="text-gray-300 mb-1">
                        "Incredible 200 IM today! That's a 5-second PR!"
                      </p>
                      <p className="text-xs text-gray-500">Coach Martinez • 2 hours ago</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-white text-center">Platform Features</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <div
                key={i}
                className="border-2 border-[#a855f7]/25 rounded-2xl p-8 bg-black/20 text-center"
              >
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-300 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-2 border-[#a855f7]/25 rounded-2xl p-12 bg-gradient-to-br from-[#a855f7]/10 to-[#d946ef]/10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to transform your program?
          </h2>
          <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
            Join coaches who are using METTLE to build culture, track progress, and engage parents.
          </p>
          <a
            href="mailto:ramichehq@gmail.com?subject=METTLE Demo Request"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity min-h-[44px]"
          >
            Contact Us
          </a>
        </section>
      </div>
    </div>
  );
}
