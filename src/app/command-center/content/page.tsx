"use client";

import { useState, useEffect } from "react";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

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
const STATUS_COLORS: Record<string, string> = { draft: "var(--c-amber)", reviewed: "var(--c-indigo)", approved: "var(--c-green)", posted: "var(--c-cyan)" };

export default function ContentPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [activeDay, setActiveDay] = useState(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
  });
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", platform: "All" as ContentItem["platform"] });

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsRes, contentRes] = await Promise.all([
          fetch("/api/command-center/agents"),
          fetch("/api/command-center/content"),
        ]);

        if (agentsRes.ok) {
          const data = await agentsRes.json();
          setAgents((data.agents || []).filter((a: AgentStatus) => ["ink", "echo", "vee"].includes(a.id)));
        }

        if (contentRes.ok) {
          const contentData = await contentRes.json();
          if (contentData.items && contentData.items.length > 0) {
            setContentItems(contentData.items);
          }
        }
      } catch { /* keep existing */ }
    }

    fetchData();
    const i = setInterval(fetchData, 30_000);
    return () => clearInterval(i);
  }, []);

  const todaySchedule = SCHEDULE.find((s) => s.day === activeDay);
  const TEAM = [
    { id: "vee", name: "VEE", role: "Brand Strategy", color: "var(--c-cyan)", currentTask: "Review division focus + decide angle" },
    { id: "ink", name: "INK", role: "Content Creator", color: "var(--c-amber)", currentTask: "Draft post copy (all 3 platforms)" },
    { id: "echo", name: "ECHO", role: "Community & Social", color: "var(--c-indigo)", currentTask: "Review engagement potential + hashtags" },
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
    <InstrumentPage
      id="content"
      title="Content Pipeline"
      section="Creative"
      icon="spark"
      accent="var(--c-fuchsia)"
    >
      <p className="mono" style={{ fontSize: 12, color: "var(--t-mid)", letterSpacing: "0.12em", margin: "0 0 20px" }}>
        INK · ECHO · VEE — Content creation, publishing &amp; engagement
      </p>

      {/* Team */}
      <Panel title="Content Team" icon="agents" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginTop: 6 }}>
          {TEAM.map((agent) => {
            const live = agents.find((a) => a.id === agent.id);
            const statusColor = live?.status === "active" ? "var(--c-green)" : live?.status === "idle" ? "var(--c-amber)" : "var(--t-lo)";
            return (
              <div key={agent.id} style={{ padding: 20, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "var(--r-sm)", background: `color-mix(in srgb, ${agent.color} 14%, transparent)`, color: agent.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>{agent.name[0]}</div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t-hi)" }}>{agent.name}</span>
                      <p style={{ fontSize: 10, color: "var(--t-mid)", margin: "2px 0 0" }}>{agent.role}</p>
                    </div>
                  </div>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
                </div>
                <p className="mono" style={{ fontSize: 10, color: "var(--t-lo)", margin: "0 0 4px" }}>{live?.status?.toUpperCase() || "OFFLINE"}</p>
                <p style={{ fontSize: 9, color: "var(--t-lo)", fontStyle: "italic", margin: 0 }}>{agent.currentTask}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Weekly Schedule */}
      <Panel title="Weekly Rotation" icon="clock" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, marginTop: 6, overflowX: "auto", paddingBottom: 8 }}>
          {SCHEDULE.map((day) => (
            <button key={day.day} onClick={() => setActiveDay(day.day)} style={{ padding: "10px 16px", borderRadius: "var(--r-sm)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s", background: activeDay === day.day ? "color-mix(in srgb, var(--c-fuchsia) 15%, transparent)" : "var(--ink-2)", border: activeDay === day.day ? "1px solid color-mix(in srgb, var(--c-fuchsia) 40%, transparent)" : "1px solid var(--line)", color: activeDay === day.day ? "var(--c-fuchsia)" : "var(--t-mid)" }}>
              {day.day.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>

        {todaySchedule && (
          <div style={{ padding: 20, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: "1px solid color-mix(in srgb, var(--c-fuchsia) 25%, var(--line))" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--c-fuchsia)", boxShadow: "0 0 12px color-mix(in srgb, var(--c-fuchsia) 60%, transparent)" }} />
              <span className="mono" style={{ fontSize: 11, color: "var(--c-fuchsia)", letterSpacing: "0.15em", fontWeight: 700 }}>{todaySchedule.day.toUpperCase()} — {todaySchedule.division.toUpperCase()}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px", color: "var(--t-hi)" }}>{todaySchedule.focus}</h3>
            <p style={{ fontSize: 13, color: "var(--t-mid)", margin: 0 }}>{todaySchedule.angle}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {PLATFORMS.map((p) => <span key={p} style={{ padding: "5px 12px", fontSize: 10, background: "var(--ink-3)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", letterSpacing: "0.1em", color: "var(--t-mid)" }}>{p.toUpperCase()}</span>)}
            </div>
          </div>
        )}
      </Panel>

      {/* Pipeline Status */}
      <Panel title="Pipeline Status" icon="pulse" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginTop: 6 }}>
          {(["draft", "reviewed", "approved", "posted"] as const).map((status) => (
            <div key={status} style={{ padding: 20, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: "1px solid var(--line)", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: STATUS_COLORS[status], marginBottom: 4 }}>{pipelineCounts[status]}</div>
              <span className="mono" style={{ fontSize: 10, color: "var(--t-lo)", letterSpacing: "0.15em" }}>{status.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Content Board */}
      <Panel
        title="Content Board"
        icon="dashboard"
        badge={<button onClick={() => setShowCreateModal(true)} style={{ padding: "6px 12px", fontSize: 10, background: "color-mix(in srgb, var(--c-fuchsia) 20%, transparent)", border: "1px solid color-mix(in srgb, var(--c-fuchsia) 30%, transparent)", borderRadius: "var(--r-sm)", color: "var(--c-fuchsia)", cursor: "pointer" }}>+ NEW</button>}
        style={{ marginBottom: 20 }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginTop: 6 }}>
          {(["draft", "reviewed", "approved", "posted"] as const).map((stageName) => (
            <div key={stageName}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--t-lo)", letterSpacing: "0.15em" }}>{stageName.toUpperCase()}</span>
                <span style={{ fontSize: 10, color: "var(--t-lo)" }}>{contentItems.filter((i) => i.stage === stageName).length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {contentItems.filter((item) => item.stage === stageName).map((item) => (
                  <div key={item.id} style={{ padding: 16, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t-hi)" }}>{item.title}</span>
                      <span style={{ fontSize: 9, padding: "3px 8px", background: "var(--ink-3)", borderRadius: "var(--r-xs)", color: "var(--t-mid)" }}>{item.platform}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--t-mid)", marginBottom: 12, lineHeight: 1.4 }}>{item.content.slice(0, 60)}...</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 9, color: "var(--t-lo)" }}>{item.assignee}</span>
                      {stageName !== "posted" && (
                        <button onClick={() => handleStageChange(item.id, stageName === "draft" ? "reviewed" : stageName === "reviewed" ? "approved" : "posted")} style={{ fontSize: 9, padding: "4px 10px", background: "color-mix(in srgb, var(--c-fuchsia) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--c-fuchsia) 25%, transparent)", borderRadius: "var(--r-xs)", color: "var(--c-fuchsia)", cursor: "pointer" }}>
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
      </Panel>

      {/* Analytics */}
      <Panel title="Performance" icon="finance" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 16, marginTop: 6, marginBottom: 20 }}>
          {[{ label: "Total Reach", value: "5.2K", change: "+12%" }, { label: "Engagement Rate", value: "7.3%", change: "+2.1%" }, { label: "Posts This Week", value: "5", change: "+1" }, { label: "Top Platform", value: "Instagram", change: "—" }].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--t-hi)" }}>{stat.value}</div>
              <div className="mono" style={{ fontSize: 9, color: "var(--t-lo)", letterSpacing: "0.1em", marginTop: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 9, color: "var(--c-green)", marginTop: 2 }}>{stat.change}</div>
            </div>
          ))}
        </div>
        {contentItems.filter((i) => i.stage === "posted" && i.performance).map((post) => (
          <div key={post.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--line)" }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--t-hi)" }}>{post.title}</div>
              <div style={{ fontSize: 9, color: "var(--t-lo)" }}>{post.platform} • Posted {post.dueDate}</div>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 11 }}>
              <span style={{ color: "var(--c-pink)" }}>♥ {post.performance?.likes}</span>
              <span style={{ color: "var(--c-sky)" }}>💬 {post.performance?.comments}</span>
              <span style={{ color: "var(--c-green)" }}>↗ {post.performance?.shares}</span>
            </div>
          </div>
        ))}
      </Panel>

      {/* Tools & Publish */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 20 }}>
        <Panel title="Hashtag Bank" icon="hash">
          <div style={{ marginTop: 6 }}>
            {Object.entries(HASHTAG_BANK).slice(0, 4).map(([division, tags]) => (
              <div key={division} style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 9, color: "var(--t-lo)" }}>{division}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {tags.map((tag) => <span key={tag} style={{ fontSize: 9, padding: "4px 8px", background: "var(--ink-2)", borderRadius: "var(--r-xs)", color: "var(--t-mid)" }}>{tag}</span>)}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Templates" icon="dispatch">
          <div style={{ marginTop: 6 }}>
            {POST_TEMPLATES.map((template) => (
              <div key={template.name} style={{ padding: 12, background: "var(--ink-2)", borderRadius: "var(--r-sm)", marginBottom: 8, cursor: "pointer" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t-hi)" }}>{template.name}</div>
                <div style={{ fontSize: 9, color: "var(--t-lo)", marginTop: 2 }}>{template.structure}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Parallax Publish */}
      <Panel title="Parallax Publish" icon="dispatch" style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, var(--line))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginTop: 6 }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--t-lo)", margin: 0 }}>Multi-platform social media publishing</p>
          </div>
          <a href="https://parallax-publish.vercel.app" target="_blank" rel="noopener noreferrer" style={{ padding: "10px 18px", background: "var(--accent)", borderRadius: "var(--r-sm)", color: "var(--ink-1)", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Open Publish →</a>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 10, color: "var(--t-lo)" }}>
          <span style={{ color: "var(--c-green)" }}>✓ Instagram Connected</span>
          <span style={{ color: "var(--c-green)" }}>✓ X Connected</span>
          <span style={{ color: "var(--c-amber)" }}>⏳ LinkedIn Pending</span>
        </div>
        <p style={{ fontSize: 9, color: "var(--t-lo)", marginTop: 12 }}>Post times (EST): Instagram 11am/7pm • X 9am/1pm • LinkedIn 8am/12pm</p>
      </Panel>

      {/* Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ width: "100%", maxWidth: 480, padding: 28, borderRadius: "var(--r-lg)", background: "var(--ink-1)", border: "1px solid var(--line-2)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--t-hi)" }}>Create New Content</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, color: "var(--t-mid)", marginBottom: 6, display: "block" }}>Title</label>
                <input type="text" value={newPost.title} onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))} style={{ width: "100%", padding: "10px 12px", background: "var(--ink-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--t-hi)", outline: "none" }} placeholder="Enter title..." />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "var(--t-mid)", marginBottom: 6, display: "block" }}>Platform</label>
                <select value={newPost.platform} onChange={(e) => setNewPost((p) => ({ ...p, platform: e.target.value as ContentItem["platform"] }))} style={{ width: "100%", padding: "10px 12px", background: "var(--ink-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--t-hi)", outline: "none" }}>
                  <option value="All">All Platforms</option>
                  <option value="Instagram">Instagram</option>
                  <option value="X">X (Twitter)</option>
                  <option value="LinkedIn">LinkedIn</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: "var(--t-mid)", marginBottom: 6, display: "block" }}>Content</label>
                <textarea value={newPost.content} onChange={(e) => setNewPost((p) => ({ ...p, content: e.target.value }))} rows={4} style={{ width: "100%", padding: "10px 12px", background: "var(--ink-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--t-hi)", outline: "none", resize: "none" }} placeholder="Write your content..." />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding: "10px 16px", fontSize: 12, color: "var(--t-mid)", background: "transparent", border: "none", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreatePost} style={{ padding: "10px 20px", fontSize: 12, background: "var(--c-fuchsia)", borderRadius: "var(--r-sm)", color: "var(--ink-1)", fontWeight: 700, border: "none", cursor: "pointer" }}>Create Draft</button>
            </div>
          </div>
        </div>
      )}
    </InstrumentPage>
  );
}
