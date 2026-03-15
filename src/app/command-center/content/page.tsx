/* ═════════════════════════════════════════════════════════════════════════════
   CONTENT PIPELINE — Command Center
   Team: INK (Content) · ECHO (Social) · VEE (Brand)
   Enhanced: Parallax Publish Integration + Workflow Management
   ═════════════════════════════════════════════════════════════════════════════ */
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTime } from "@/hooks/useTime";

/* ── Types ──────────────────────────────────────────────────────────────────── */

type TeamMember = {
  id: string;
  name: string;
  role: string;
  status: "online" | "busy" | "away" | "offline";
  currentTask?: string;
  avatar: string;
};

type WeekDay = {
  day: string;
  theme: string;
  focus: string;
  platforms: string[];
  active: boolean;
};

type PipelineStage = {
  name: "DRAFT" | "REVIEWED" | "APPROVED" | "POSTED";
  count: number;
  color: string;
};

type Platform = {
  name: string;
  connected: boolean;
  followers: string;
  status: "active" | "pending" | "error";
};

type ContentItem = {
  id: string;
  title: string;
  content: string;
  platform: "Instagram" | "X" | "LinkedIn" | "All";
  stage: PipelineStage["name"];
  assignee: string;
  dueDate: string;
  createdAt: string;
  mediaUrls?: string[];
  scheduledTime?: string;
  performance?: {
    likes: number;
    comments: number;
    shares: number;
    reach: number;
  };
};

/* ── Data ──────────────────────────────────────────────────────────────────── */

const HASHTAG_BANK: Record<string, string[]> = {
  "Parallax": ["#AI", "#Automation", "#BusinessGrowth", "#AITools", "#Productivity"],
  "Ramiche Studio": ["#Design", "#Creative", "#Branding", "#VisualIdentity", "#Portfolio"],
  "Galactik Antics": ["#AIArt", "#DigitalArt", "#Merch", "#CreativeCulture", "#ArtDrop"],
  "ClawGuard Pro": ["#CyberSecurity", "#InfoSec", "#BusinessProtection", "#SecurityTips", "#Vulnerability"],
  "Community": ["#BehindTheScenes", "#FounderJourney", "#TeamCulture", "#BuildInPublic", "#StartupLife"],
  "Educational": ["#AITips", "#TechTips", "#ProductivityHacks", "#Tutorial", "#LearnAI"],
  "Recap": ["#WeekInReview", "#Community", "#Highlights", "#QandA", "#Engagement"],
};

const POST_TEMPLATES = [
  { name: "Value Bomb", structure: "Hook → Problem → Solution → CTA" },
  { name: "Story Arc", structure: "Setup → Conflict → Resolution → Lesson" },
  { name: "Listicle", structure: "Numbered tips with bold takeaways" },
  { name: "Behind the Scenes", structure: "Process peek → Result → Insight" },
  { name: "Question Hook", structure: "Provocative Q → Answer → Engagement CTA" },
];

const TEAM: TeamMember[] = [
  {
    id: "vee",
    name: "VEE",
    role: "Brand Strategy",
    status: "offline",
    currentTask: "Review division focus + decide angle/hook",
    avatar: "V",
  },
  {
    id: "ink",
    name: "INK",
    role: "Content Creator",
    status: "offline",
    currentTask: "Draft post copy (all 3 platforms)",
    avatar: "I",
  },
  {
    id: "echo",
    name: "ECHO",
    role: "Community & Social",
    status: "offline",
    currentTask: "Review engagement potential + hashtags",
    avatar: "E",
  },
];

const WEEKLY_ROTATION: WeekDay[] = [
  { day: "MONDAY", theme: "Parallax", focus: "AI agents + skills, marketplace value", platforms: ["Instagram", "X", "LinkedIn"], active: false },
  { day: "TUESDAY", theme: "Ramiche Studio", focus: "Creative services, portfolio, client wins", platforms: ["Instagram", "X", "LinkedIn"], active: false },
  { day: "WEDNESDAY", theme: "Galactik Antics", focus: "AI art + merch, culture, behind-the-vibe", platforms: ["Instagram", "X", "LinkedIn"], active: false },
  { day: "THURSDAY", theme: "ClawGuard Pro", focus: "Security tips, vulnerability awareness", platforms: ["Instagram", "X", "LinkedIn"], active: false },
  { day: "FRIDAY", theme: "Community", focus: "Behind-the-scenes, brand storytelling", platforms: ["Instagram", "X", "LinkedIn"], active: false },
  { day: "SATURDAY", theme: "Educational", focus: "AI tips, productivity hacks, tutorials", platforms: ["Instagram", "X", "LinkedIn"], active: true },
  { day: "SUNDAY", theme: "Recap", focus: "Week highlights, community shoutouts, Q&A", platforms: ["Instagram", "X", "LinkedIn"], active: false },
];

const PIPELINE: PipelineStage[] = [
  { name: "DRAFT", count: 0, color: "#22d3ee" },
  { name: "REVIEWED", count: 0, color: "#a855f7" },
  { name: "APPROVED", count: 0, color: "#34d399" },
  { name: "POSTED", count: 0, color: "#00f0ff" },
];

const PLATFORMS: Platform[] = [
  { name: "Instagram", connected: true, followers: "16,106", status: "active" },
  { name: "X (Twitter)", connected: true, followers: "19", status: "active" },
  { name: "LinkedIn", connected: true, followers: "—", status: "pending" },
];

const SAMPLE_CONTENT: ContentItem[] = [
  {
    id: "1",
    title: "AI Tips for Coaches",
    content: "5 ways AI is transforming swim training analytics...",
    platform: "LinkedIn",
    stage: "DRAFT",
    assignee: "INK",
    dueDate: "2026-03-15",
    createdAt: "2026-03-14",
  },
  {
    id: "2",
    title: "Weekend Motivation",
    content: "Champions are made when no one is watching...",
    platform: "Instagram",
    stage: "REVIEWED",
    assignee: "VEE",
    dueDate: "2026-03-15",
    createdAt: "2026-03-13",
  },
  {
    id: "3",
    title: "Design Process Reveal",
    content: "How we built the METTLE brand identity in 48 hours...",
    platform: "All",
    stage: "POSTED",
    assignee: "ECHO",
    dueDate: "2026-03-13",
    createdAt: "2026-03-12",
    performance: { likes: 342, comments: 28, shares: 15, reach: 5200 },
  },
];

/* ── Component ────────────────────────────────────────────────────────────── */

export default function ContentPipelinePage() {
  const { time, dateStr } = useTime();
  const [activeDay, setActiveDay] = useState("SATURDAY");
  const [contentItems, setContentItems] = useState<ContentItem[]>(SAMPLE_CONTENT);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", platform: "All" as ContentItem["platform"] });

  // Calculate pipeline counts from content items
  const pipelineWithCounts = PIPELINE.map(stage => ({
    ...stage,
    count: contentItems.filter(item => item.stage === stage.name).length
  }));

  const handleStageChange = (itemId: string, newStage: PipelineStage["name"]) => {
    setContentItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, stage: newStage } : item
    ));
  };

  const handleCreatePost = () => {
    if (!newPost.title || !newPost.content) return;
    const post: ContentItem = {
      id: Date.now().toString(),
      title: newPost.title,
      content: newPost.content,
      platform: newPost.platform,
      stage: "DRAFT",
      assignee: "INK",
      dueDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString().split("T")[0],
    };
    setContentItems(prev => [...prev, post]);
    setNewPost({ title: "", content: "", platform: "All" });
    setShowCreateModal(false);
  };

  return (
    <div className="min-h-screen bg-[#030005] text-white overflow-x-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full top-[-10%] left-[-10%] bg-gradient-to-br from-[#00f0ff]/5 to-transparent" />
        <div className="absolute w-[400px] h-[400px] rounded-full bottom-[10%] right-[5%] bg-gradient-to-tl from-[#a855f7]/5 to-transparent" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full px-6 lg:px-10 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/command-center" className="text-[#00f0ff]/60 hover:text-[#00f0ff] text-sm font-mono">
            [← COMMAND CENTER]
          </Link>
          <div className="text-right">
            <div className="text-3xl font-mono text-[#00f0ff] tabular-nums">{time}</div>
            <div className="text-xs text-white/30 font-mono">{dateStr} • EST</div>
          </div>
        </div>

        <h1 className="text-4xl lg:text-5xl font-black mb-2">
          <span className="bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#e879f9] bg-clip-text text-transparent">
            Content Pipeline
          </span>
        </h1>
        <p className="text-white/50 font-mono text-sm">INK · ECHO · VEE — Content creation, publishing & engagement</p>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 lg:px-10 pb-20 space-y-8">

        {/* Content Team */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TEAM.map((member) => (
            <div
              key={member.id}
              className="p-5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00f0ff]/20 to-[#a855f7]/20 flex items-center justify-center text-lg font-bold text-[#00f0ff]">
                  {member.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white">{member.name}</h3>
                    <span className={`w-2 h-2 rounded-full ${
                      member.status === "online" ? "bg-green-500" :
                      member.status === "busy" ? "bg-yellow-500" :
                      member.status === "away" ? "bg-orange-500" : "bg-gray-500"
                    }`} />
                  </div>
                  <p className="text-xs text-white/50 font-mono mb-2">{member.role}</p>
                  <p className="text-xs text-white/30">{member.currentTask}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Weekly Rotation */}
        <section className="p-6 rounded-lg border border-white/10 bg-white/[0.02]">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-[#00f0ff]">●</span> Weekly Rotation
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            {WEEKLY_ROTATION.map((day) => (
              <button
                key={day.day}
                onClick={() => setActiveDay(day.day)}
                className={`p-3 rounded text-left transition-colors ${
                  day.active
                    ? "bg-gradient-to-br from-[#00f0ff]/20 to-[#a855f7]/20 border border-[#00f0ff]/30"
                    : "bg-white/[0.02] hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <div className="text-[10px] font-mono text-white/40 mb-1">{day.day}</div>
                <div className={`text-xs font-bold mb-1 ${day.active ? "text-[#00f0ff]" : "text-white/70"}`}>
                  {day.theme}
                </div>
                <div className="text-[9px] text-white/30 truncate">{day.focus}</div>
              </button>
            ))}
          </div>

          {/* Active Day Detail */}
          {(() => {
            const day = WEEKLY_ROTATION.find((d) => d.day === activeDay);
            if (!day) return null;
            return (
              <div className="mt-4 p-4 rounded bg-white/[0.03] border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-white">{day.day} — {day.theme}</h3>
                  <div className="flex gap-2">
                    {day.platforms.map((p) => (
                      <span key={p} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] text-white/40 font-mono">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-white/50">{day.focus}</p>
              </div>
            );
          })()}
        </section>

        {/* Pipeline Status */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pipelineWithCounts.map((stage) => (
            <button
              key={stage.name}
              className="p-5 rounded-lg border border-white/10 bg-white/[0.02] text-center hover:bg-white/[0.04] transition-colors"
            >
              <div
                className="text-4xl font-black mb-2"
                style={{ color: stage.color }}
              >
                {stage.count}
              </div>
              <div className="text-xs font-mono text-white/40 uppercase tracking-wider">
                {stage.name}
              </div>
            </button>
          ))}
        </section>

        {/* Content Items Pipeline */}
        <section className="p-6 rounded-lg border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Content Pipeline</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded bg-[#00f0ff]/20 text-[#00f0ff] text-sm font-mono hover:bg-[#00f0ff]/30 transition-colors border border-[#00f0ff]/30"
            >
              + New Content
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {(["DRAFT", "REVIEWED", "APPROVED", "POSTED"] as const).map((stageName) => (
              <div key={stageName} className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-white/50">{stageName}</h3>
                  <span className="text-xs text-white/30">
                    {contentItems.filter(i => i.stage === stageName).length}
                  </span>
                </div>
                {contentItems.filter(item => item.stage === stageName).map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded bg-white/[0.03] border border-white/10 hover:border-[#00f0ff]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm text-white">{item.title}</h4>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40">
                        {item.platform}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 mb-3 line-clamp-2">{item.content}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-white/30">{item.assignee}</span>
                      {stageName !== "POSTED" && (
                        <button
                          onClick={() => handleStageChange(item.id, stageName === "DRAFT" ? "REVIEWED" : stageName === "REVIEWED" ? "APPROVED" : "POSTED")}
                          className="text-[9px] px-2 py-1 rounded bg-[#00f0ff]/10 text-[#00f0ff] hover:bg-[#00f0ff]/20"
                        >
                          → {stageName === "DRAFT" ? "Review" : stageName === "REVIEWED" ? "Approve" : "Post"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Idea Backlog */}
        <section className="p-6 rounded-lg border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="text-[#34d399]">+</span> Idea Backlog
            </h2>
            <button className="text-xs px-3 py-1.5 rounded bg-[#34d399]/20 text-[#34d399] hover:bg-[#34d399]/30">
              + Add Idea
            </button>
          </div>
          <div className="space-y-2">
            {[
              { idea: "How AI agents handle calendar scheduling", division: "Parallax", priority: "HIGH" },
              { idea: "Before/after: Client brand refresh", division: "Ramiche Studio", priority: "MED" },
              { idea: "New Galaxy poster drop teaser", division: "Galactik Antics", priority: "HIGH" },
              { idea: "5 signs your business needs a security scan", division: "ClawGuard Pro", priority: "MED" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded bg-white/[0.03] hover:bg-white/[0.05] group">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    item.priority === "HIGH" ? "bg-red-400" : "bg-yellow-400"
                  }`} />
                  <span className="text-sm text-white/70">{item.idea}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] text-white/40">{item.division}</span>
                  <button className="opacity-0 group-hover:opacity-100 text-[10px] px-2 py-1 rounded bg-[#00f0ff]/20 text-[#00f0ff]">
                    Start Draft →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Media Library */}
        <section className="p-6 rounded-lg border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="text-[#e879f9]">◉</span> Media Library
            </h2>
            <button className="text-xs px-3 py-1.5 rounded bg-[#e879f9]/20 text-[#e879f9] hover:bg-[#e879f9]/30">
              + Upload
            </button>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded bg-white/[0.03] border border-white/10 flex items-center justify-center hover:border-[#e879f9]/30 cursor-pointer transition-colors"
              >
                <span className="text-white/20 text-2xl">+</span>
              </div>
            ))}
          </div>
        </section>

        {/* Performance Analytics */}
        <section className="p-6 rounded-lg border border-white/10 bg-white/[0.02]">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-[#00f0ff]">◈</span> Performance
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Total Reach", value: "5.2K", change: "+12%" },
              { label: "Engagement Rate", value: "7.3%", change: "+2.1%" },
              { label: "Posts This Week", value: "5", change: "+1" },
              { label: "Top Platform", value: "Instagram", change: "—" },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded bg-white/[0.03] text-center">
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-[10px] text-white/40 font-mono uppercase">{stat.label}</div>
                <div className="text-[10px] text-green-400 mt-1">{stat.change}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-mono text-white/40 uppercase">Recent Posts</h3>
            {contentItems.filter(i => i.stage === "POSTED" && i.performance).map(post => (
              <div key={post.id} className="flex items-center justify-between p-3 rounded bg-white/[0.03]">
                <div>
                  <div className="text-sm text-white">{post.title}</div>
                  <div className="text-[10px] text-white/40">{post.platform} • Posted {post.dueDate}</div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-pink-400">♥ {post.performance?.likes}</span>
                  <span className="text-blue-400">💬 {post.performance?.comments}</span>
                  <span className="text-green-400">↗ {post.performance?.shares}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Content Tools Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hashtag Bank */}
          <div className="p-5 rounded-lg border border-white/10 bg-white/[0.02]">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-[#f59e0b]">#</span> Hashtag Bank
            </h3>
            <div className="space-y-3">
              {Object.entries(HASHTAG_BANK).slice(0, 4).map(([division, tags]) => (
                <div key={division} className="text-xs">
                  <span className="text-white/50 font-mono">{division}:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.map(tag => (
                      <button
                        key={tag}
                        className="px-2 py-0.5 rounded bg-white/[0.05] text-white/40 hover:bg-[#00f0ff]/10 hover:text-[#00f0ff] transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Post Templates */}
          <div className="p-5 rounded-lg border border-white/10 bg-white/[0.02]">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-[#a855f7]">◆</span> Templates
            </h3>
            <div className="space-y-2">
              {POST_TEMPLATES.map((template) => (
                <button
                  key={template.name}
                  className="w-full text-left p-2 rounded bg-white/[0.03] hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="text-xs font-medium text-white group-hover:text-[#a855f7]">{template.name}</div>
                  <div className="text-[10px] text-white/30">{template.structure}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Parallax Publish Integration */}
        <section className="p-6 rounded-lg border border-[#7c3aed]/30 bg-gradient-to-br from-[#7c3aed]/10 to-transparent">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#7c3aed" }}>Parallax Publish</h2>
              <p className="text-xs text-white/40">Multi-platform social media publishing — 4 platforms live</p>
            </div>
            <a
              href="https://parallax-publish.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded text-sm font-bold hover:opacity-90 transition-colors"
              style={{ backgroundColor: "#7c3aed", color: "white" }}
            >
              Open Publish →
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/30 font-mono">
            <span className="text-green-400">✓ Instagram Connected</span>
            <span className="text-green-400">✓ X (Twitter) Connected</span>
            <span className="text-green-400">✓ LinkedIn Connected</span>
            <span className="text-yellow-400">⚠ Blocker: Facebook Developer Portal</span>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-white/40">
              <strong>Posting Times (EST):</strong> Instagram 11 AM / 7 PM • X 9 AM / 1 PM • LinkedIn 8 AM / 12 PM
            </p>
          </div>
        </section>

        {/* Active Platforms */}
        <section className="p-6 rounded-lg border border-white/10 bg-white/[0.02]">
          <h2 className="text-lg font-bold mb-4">Active Platforms</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLATFORMS.map((platform) => (
              <div
                key={platform.name}
                className="p-4 rounded-lg border border-white/10 bg-white/[0.02] flex items-center justify-between"
              >
                <div>
                  <h3 className="font-bold text-white">{platform.name}</h3>
                  <p className={`text-xs font-mono ${
                    platform.status === "active" ? "text-green-400" :
                    platform.status === "pending" ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {platform.connected ? "CONNECTED" : "DISCONNECTED"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white/20">{platform.followers}</div>
                  <div className="text-[9px] text-white/30 font-mono">FOLLOWERS</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Create Content Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg p-6 rounded-lg border border-white/10 bg-[#0a0a0f]">
              <h3 className="text-lg font-bold mb-4">Create New Content</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Title</label>
                  <input
                    type="text"
                    value={newPost.title}
                    onChange={(e) => setNewPost(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded bg-white/[0.05] border border-white/10 text-white focus:border-[#00f0ff]/50 outline-none"
                    placeholder="Enter content title..."
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Platform</label>
                  <select
                    value={newPost.platform}
                    onChange={(e) => setNewPost(p => ({ ...p, platform: e.target.value as ContentItem["platform"] }))}
                    className="w-full px-3 py-2 rounded bg-white/[0.05] border border-white/10 text-white focus:border-[#00f0ff]/50 outline-none"
                  >
                    <option value="All">All Platforms</option>
                    <option value="Instagram">Instagram</option>
                    <option value="X">X (Twitter)</option>
                    <option value="LinkedIn">LinkedIn</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Content</label>
                  <textarea
                    value={newPost.content}
                    onChange={(e) => setNewPost(p => ({ ...p, content: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 rounded bg-white/[0.05] border border-white/10 text-white focus:border-[#00f0ff]/50 outline-none resize-none"
                    placeholder="Write your content..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-white/50 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePost}
                  className="px-4 py-2 rounded bg-[#00f0ff] text-black text-sm font-bold hover:bg-[#00f0ff]/90"
                >
                  Create Draft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Parallax Publish Modal */}
        {showPublishModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl p-6 rounded-lg border border-[#00f0ff]/20 bg-[#0a0a0f]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#00f0ff]">Parallax Publish</h3>
                <button
                  onClick={() => setShowPublishModal(false)}
                  className="text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="aspect-video rounded bg-white/[0.02] border border-white/10 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-white/30 mb-2">Parallax Publish Interface</p>
                  <a
                    href="https://parallax-publish.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded bg-[#00f0ff]/20 text-[#00f0ff] text-sm hover:bg-[#00f0ff]/30 border border-[#00f0ff]/30"
                  >
                    Open in New Tab →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
