"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   CONTENT PIPELINE — INK · ECHO · VEE
   End-to-end content creation, workflow & publishing dashboard
   ══════════════════════════════════════════════════════════════════════════════ */

interface ContentDay { day: string; division: string; focus: string; angle: string; }
interface AgentStatus { id: string; name: string; status: string; role: string; }
interface ContentItem {
  id: string; title: string; content: string;
  platform: "Instagram" | "X" | "LinkedIn" | "All";
  stage: "draft" | "reviewed" | "approved" | "posted";
  assignee: string; dueDate: string; createdAt: string;
  performance?: { likes: number; comments: number; shares: number; reach: number };
}

const SCHEDULE: ContentDay[] = [
  { day: "Monday", division: "Parallax", focus: "Agent Marketplace", angle: "AI agent capabilities, skill spotlights" },
  { day: "Tuesday", division: "Ramiche Studio", focus: "Creative Services", angle: "Portfolio pieces, design process" },
  { day: "Wednesday", division: "Galactik Antics", focus: "AI Art + Merch", angle: "Art drops, merch reveals" },
  { day: "Thursday", division: "ClawGuard Pro", focus: "Security", angle: "Security tips, vulnerability awareness" },
  { day: "Friday", division: "Community / BTS", focus: "Brand Storytelling", angle: "Day-in-the-life, founder journey" },
  { day: "Saturday", division: "Educational", focus: "AI + Tech Value", angle: "AI tips, productivity hacks, tutorials" },
  { day: "Sunday", division: "Recap + Engagement", focus: "Community", angle: "Week highlights, shoutouts, Q&A" },
];

const HASHTAG_BANK: Record<string, string[]> = {
  Parallax: ["#AI", "#Automation", "#BusinessGrowth", "#AITools", "#Productivity"],
  "Ramiche Studio": ["#Design", "#Creative", "#Branding", "#VisualIdentity", "#Portfolio"],
  "Galactik Antics": ["#AIArt", "#DigitalArt", "#Merch", "#CreativeCulture", "#ArtDrop"],
  "ClawGuard Pro": ["#CyberSecurity", "#InfoSec", "#BusinessProtection", "#SecurityTips"],
  "Community / BTS": ["#BehindTheScenes", "#FounderJourney", "#TeamCulture", "#BuildInPublic"],
  Educational: ["#AITips", "#TechTips", "#ProductivityHacks", "#Tutorial", "#LearnAI"],
  "Recap + Engagement": ["#WeekInReview", "#Community", "#Highlights", "#QandA"],
};

const POST_TEMPLATES = [
  { name: "Value Bomb", structure: "Hook → Problem → Solution → CTA" },
  { name: "Story Arc", structure: "Setup → Conflict → Resolution → Lesson" },
  { name: "Listicle", structure: "Numbered tips with bold takeaways" },
  { name: "Behind the Scenes", structure: "Process peek → Result → Insight" },
  { name: "Question Hook", structure: "Provocative Q → Answer → Engagement CTA" },
];

const PLATFORMS = ["Instagram", "X", "LinkedIn"];
const STATUS_COLORS: Record<string, string> = { draft: "#f59e0b", reviewed: "#818cf8", approved: "#22c55e", posted: "#06b6d4" };

export default function ContentPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
  });
  const [contentItems, setContentItems] = useState<ContentItem[]>([
    { id: "1", title: "AI Tips for Coaches", content: "5 ways AI is transforming swim training...", platform: "LinkedIn", stage: "draft", assignee: "INK", dueDate: "2026-03-15", createdAt: "2026-03-14" },
    { id: "2", title: "Weekend Motivation", content: "Champions are made when no one is watching...", platform: "Instagram", stage: "reviewed", assignee: "VEE", dueDate: "2026-03-15", createdAt: "2026-03-13" },
    { id: "3", title: "Design Process Reveal", content: "How we built the METTLE brand identity...", platform: "All", stage: "posted", assignee: "ECHO", dueDate: "2026-03-13", createdAt: "2026-03-12", performance: { likes: 342, comments: 28, shares: 15, reach: 5200 } },
  ]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", platform: "All" as ContentItem["platform"] });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents((data.agents || []).filter((a: AgentStatus) => ["ink", "echo", "vee"].includes(a.id)));
      }
    } catch { /* keep existing */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30_000); return () => clearInterval(i); }, [fetchData]);

  const todaySchedule = SCHEDULE.find((s) => s.day === activeDay);
  const TEAM = [
    { id: "vee", name: "VEE", role: "Brand Strategy", color: "#06b6d4", currentTask: "Review division focus + decide angle" },
    { id: "ink", name: "INK", role: "Content Creator", color: "#f59e0b", currentTask: "Draft post copy (all 3 platforms)" },
    { id: "echo", name: "ECHO", role: "Community & Social", color: "#818cf8", currentTask: "Review engagement potential + hashtags" },
  ];

  const pipelineCounts = {
    draft: contentItems.filter((i) => i.stage === "draft").length,
    reviewed: contentItems.filter((i) => i.stage === "reviewed").length,
    approved: contentItems.filter((i) => i.stage === "approved").length,
    posted: contentItems.filter((i) => i.stage === "posted").length,
  };

  const handleStageChange = (itemId: string, newStage: ContentItem["stage"]) => {
    setContentItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, stage: newStage } : item)));
  };

  const handleCreatePost = () => {
    if (!newPost.title || !newPost.content) return;
    const post: ContentItem = {
      id: Date.now().toString(), title: newPost.title, content: newPost.content,
      platform: newPost.platform, stage: "draft", assignee: "INK",
      dueDate: new Date().toISOString().split("T")[0], createdAt: new Date().toISOString().split("T")[0],
    };
    setContentItems((prev) => [...prev, post]);
    setNewPost({ title: "", content: "", platform: "All" });
    setShowCreateModal(false);
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 800px 600px at 25% 25%, rgba(249,115,22,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 75% 80%, rgba(245,158,11,0.06) 0%, transparent 60%)" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(249,115,22,0.3)" }}>Content Pipeline</h1>
          <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>INK · ECHO · VEE — Content creation, publishing & engagement</p>
        </div>

        {/* Team */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f97316", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Content Team</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
          {TEAM.map((agent) => {
            const live = agents.find((a) => a.id === agent.id);
            const statusColor = live?.status === "active" ? "#22c55e" : live?.status === "idle" ? "#f59e0b" : "#6b7280";
            return (
              <div key={agent.id} style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: `0 0 24px ${agent.color}12, 0 8px 32px rgba(0,0,0,0.4)` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${agent.color}18`, color: agent.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>{agent.name[0]}</div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{agent.name}</span>
                      <p style={{ fontSize: 10, color: "#737373", margin: "2px 0 0" }}>{agent.role}</p>
                    </div>
                  </div>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}80` }} />
                </div>
                <p style={{ fontSize: 10, color: "#525252", margin: "0 0 4px" }}>{live?.status?.toUpperCase() || "OFFLINE"}</p>
                <p style={{ fontSize: 9, color: "#404040", fontStyle: "italic" }}>{agent.currentTask}</p>
              </div>
            );
          })}
        </div>

        {/* Weekly Schedule */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f97316", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Weekly Rotation</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 8 }}>
          {SCHEDULE.map((day) => (
            <button key={day.day} onClick={() => setActiveDay(day.day)} style={{ padding: "10px 16px", borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s", background: activeDay === day.day ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)", border: activeDay === day.day ? "1px solid rgba(249,115,22,0.4)" : "1px solid rgba(255,255,255,0.08)", color: activeDay === day.day ? "#fb923c" : "rgba(255,255,255,0.4)" }}>
              {day.day.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>

        {todaySchedule && (
          <div style={{ padding: 28, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(249,115,22,0.25)", boxShadow: "0 0 32px rgba(249,115,22,0.1), 0 8px 32px rgba(0,0,0,0.4)", marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#f97316", boxShadow: "0 0 12px rgba(249,115,22,0.6)" }} />
              <span style={{ fontSize: 11, color: "#fb923c", letterSpacing: "0.15em", fontWeight: 700 }}>{todaySchedule.day.toUpperCase()} — {todaySchedule.division.toUpperCase()}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>{todaySchedule.focus}</h3>
            <p style={{ fontSize: 13, color: "#737373", margin: 0 }}>{todaySchedule.angle}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {PLATFORMS.map((p) => <span key={p} style={{ padding: "5px 12px", fontSize: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>{p.toUpperCase()}</span>)}
            </div>
          </div>
        )}

        {/* Pipeline Status */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f97316", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Pipeline Status</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 32 }}>
          {(["draft", "reviewed", "approved", "posted"] as const).map((status) => (
            <div key={status} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: STATUS_COLORS[status], marginBottom: 4 }}>{pipelineCounts[status]}</div>
              <span style={{ fontSize: 10, color: "#525252", letterSpacing: "0.15em" }}>{status.toUpperCase()}</span>
            </div>
          ))}
        </div>

        {/* Content Board */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f97316", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>
          Content Board
          <button onClick={() => setShowCreateModal(true)} style={{ marginLeft: 12, padding: "6px 12px", fontSize: 10, background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 6, color: "#fb923c", cursor: "pointer" }}>+ NEW</button>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
          {(["draft", "reviewed", "approved", "posted"] as const).map((stageName) => (
            <div key={stageName}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#525252", letterSpacing: "0.15em" }}>{stageName.toUpperCase()}</span>
                <span style={{ fontSize: 10, color: "#404040" }}>{contentItems.filter((i) => i.stage === stageName).length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {contentItems.filter((item) => item.stage === stageName).map((item) => (
                  <div key={item.id} style={{ padding: 16, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#e5e5e5" }}>{item.title}</span>
                      <span style={{ fontSize: 9, padding: "3px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 4, color: "#737373" }}>{item.platform}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#525252", marginBottom: 12, lineHeight: 1.4 }}>{item.content.slice(0, 60)}...</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 9, color: "#404040" }}>{item.assignee}</span>
                      {stageName !== "posted" && (
                        <button onClick={() => handleStageChange(item.id, stageName === "draft" ? "reviewed" : stageName === "reviewed" ? "approved" : "posted")} style={{ fontSize: 9, padding: "4px 10px", background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 4, color: "#fb923c", cursor: "pointer" }}>
                          → {stageName === "draft" ? "Review" : stageName === "reviewed" ? "Approve" : "Post"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Analytics */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f97316", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Performance</h2>
        <div style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 32 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 16, marginBottom: 20 }}>
            {[{ label: "Total Reach", value: "5.2K", change: "+12%" }, { label: "Engagement Rate", value: "7.3%", change: "+2.1%" }, { label: "Posts This Week", value: "5", change: "+1" }, { label: "Top Platform", value: "Instagram", change: "—" }].map((stat) => (
              <div key={stat.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#e5e5e5" }}>{stat.value}</div>
                <div style={{ fontSize: 9, color: "#525252", letterSpacing: "0.1em", marginTop: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 9, color: "#22c55e", marginTop: 2 }}>{stat.change}</div>
              </div>
            ))}
          </div>
          {contentItems.filter((i) => i.stage === "posted" && i.performance).map((post) => (
            <div key={post.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div>
                <div style={{ fontSize: 13, color: "#e5e5e5" }}>{post.title}</div>
                <div style={{ fontSize: 9, color: "#525252" }}>{post.platform} • Posted {post.dueDate}</div>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
                <span style={{ color: "#ec4899" }}>♥ {post.performance?.likes}</span>
                <span style={{ color: "#3b82f6" }}>💬 {post.performance?.comments}</span>
                <span style={{ color: "#22c55e" }}>↗ {post.performance?.shares}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tools & Publish */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 32 }}>
          <div style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 16 }}># Hashtag Bank</h3>
            {Object.entries(HASHTAG_BANK).slice(0, 4).map(([division, tags]) => (
              <div key={division} style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 9, color: "#525252" }}>{division}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {tags.map((tag) => <span key={tag} style={{ fontSize: 9, padding: "4px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 4, color: "#737373" }}>{tag}</span>)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 16 }}>◆ Templates</h3>
            {POST_TEMPLATES.map((template) => (
              <div key={template.name} style={{ padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 8, cursor: "pointer" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#e5e5e5" }}>{template.name}</div>
                <div style={{ fontSize: 9, color: "#525252", marginTop: 2 }}>{template.structure}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Parallax Publish */}
        <div style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(124,58,237,0.3)", boxShadow: "0 0 32px rgba(124,58,237,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", margin: 0 }}>Parallax Publish</h3>
              <p style={{ fontSize: 11, color: "#525252", margin: "4px 0 0" }}>Multi-platform social media publishing</p>
            </div>
            <a href="https://parallax-publish.vercel.app" target="_blank" rel="noopener noreferrer" style={{ padding: "10px 18px", background: "#7c3aed", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Open Publish →</a>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 10, color: "#525252" }}>
            <span style={{ color: "#22c55e" }}>✓ Instagram Connected</span>
            <span style={{ color: "#22c55e" }}>✓ X Connected</span>
            <span style={{ color: "#eab308" }}>⏳ LinkedIn Pending</span>
          </div>
          <p style={{ fontSize: 9, color: "#404040", marginTop: 12 }}>Post times (EST): Instagram 11am/7pm • X 9am/1pm • LinkedIn 8am/12pm</p>
        </div>
      </div>

      {/* Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ width: "100%", maxWidth: 480, padding: 28, borderRadius: 16, background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Create New Content</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, color: "#525252", marginBottom: 6, display: "block" }}>Title</label>
                <input type="text" value={newPost.title} onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))} style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e5e5e5", outline: "none" }} placeholder="Enter title..." />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#525252", marginBottom: 6, display: "block" }}>Platform</label>
                <select value={newPost.platform} onChange={(e) => setNewPost((p) => ({ ...p, platform: e.target.value as ContentItem["platform"] }))} style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e5e5e5", outline: "none" }}>
                  <option value="All">All Platforms</option>
                  <option value="Instagram">Instagram</option>
                  <option value="X">X (Twitter)</option>
                  <option value="LinkedIn">LinkedIn</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#525252", marginBottom: 6, display: "block" }}>Content</label>
                <textarea value={newPost.content} onChange={(e) => setNewPost((p) => ({ ...p, content: e.target.value }))} rows={4} style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e5e5e5", outline: "none", resize: "none" }} placeholder="Write your content..." />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding: "10px 16px", fontSize: 12, color: "#737373", background: "transparent", border: "none", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreatePost} style={{ padding: "10px 20px", fontSize: 12, background: "#f97316", borderRadius: 8, color: "#000", fontWeight: 700, border: "none", cursor: "pointer" }}>Create Draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
