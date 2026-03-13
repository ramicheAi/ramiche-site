"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/* ══════════════════════════════════════════════════════════════════════════════
   COMMAND CENTER CHAT — Unified Design Language
   Three-column real-time chat interface for agent coordination
   Matches Command Center v4 design tokens exactly.
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── DESIGN TOKENS (mirrors command-center/page.tsx) ──────────────────────── */
const COLORS = {
  bg: {
    main: "#0a0a0a",
    card: "rgba(255,255,255,0.02)",
    elevated: "#111111",
    input: "#0a0a0a",
    hover: "rgba(255,255,255,0.04)",
  },
  border: {
    default: "#1e1e1e",
    subtle: "rgba(255,255,255,0.06)",
  },
  text: {
    primary: "#e5e5e5",
    secondary: "#888888",
    tertiary: "#666666",
  },
  accent: {
    purple: "#7c3aed",
    purpleLight: "#a855f7",
    gold: "#C9A84C",
  },
  agents: {
    atlas: "#C9A84C",
    shuri: "#34d399",
    vee: "#ec4899",
    triage: "#f472b6",
    proximon: "#f97316",
    mercury: "#fbbf24",
    widow: "#ef4444",
    michael: "#06b6d4",
    echo: "#38bdf8",
    prophets: "#d4a574",
    selah: "#10b981",
    ink: "#c084fc",
    nova: "#14b8a6",
    kiyosaki: "#fcd34d",
    simons: "#22d3ee",
    drstrange: "#a855f7",
    aetherion: "#818cf8",
    themis: "#8b5cf6",
    haven: "#4ade80",
    themaestro: "#f59e0b",
  },
  status: {
    active: "#10b981",
    idle: "#f59e0b",
    offline: "#666666",
  },
};

const FONT_FAMILY = "'Inter', system-ui, -apple-system, sans-serif";

/* ── GLOBAL NAV (matches command-center/page.tsx) ──────────────────────────── */
const NAV = [
  { label: "COMMAND", href: "/command-center", icon: "\u25C7" },
  { label: "AGENTS", href: "/command-center/agents", icon: "\u2726" },
  { label: "TASKS", href: "/command-center/tasks", icon: "\u25A3" },
  { label: "CALENDAR", href: "/command-center/calendar", icon: "\u25CB" },
  { label: "PROJECTS", href: "/command-center/projects", icon: "\u25C9" },
  { label: "MEMORY", href: "/command-center/memory", icon: "\u25CE" },
  { label: "DOCS", href: "/command-center/docs", icon: "\u2261" },
  { label: "CHAT", href: "/command-center/chat", icon: "\u25C8", active: true },
  { label: "OFFICE", href: "/command-center/office", icon: "\u25A3" },
  { label: "METTLE", href: "/apex-athlete", icon: "\u2726" },
];

/* ── DEFAULT DATA (fallback when Supabase unavailable) ──────────────────────── */
/* type: "project" = Project Chats, "team" = Team Chats (with agent members) */
const DEFAULT_CHANNELS = [
  // Project Chats
  { id: "22222222-2222-2222-2222-222222222222", name: "#general", unread: 3, description: "Team announcements", active: true, type: "project" as const },
  { id: "33333333-3333-3333-3333-333333333333", name: "#mettle", unread: 12, description: "METTLE — Athlete SaaS (#1 priority)", type: "project" as const },
  { id: "55555555-5555-5555-5555-555555555555", name: "#verified-agents", unread: 0, description: "Verified Agent Business (#2 priority)", type: "project" as const },
  { id: "44444444-4444-4444-4444-444444444444", name: "#parallax", unread: 0, description: "Parallax — Brand System", type: "project" as const },
  { id: "66666666-6666-6666-6666-666666666666", name: "#dev", unread: 7, description: "Development discussions", type: "project" as const },
  // Team Chats (with agent members — Atlas included in all)
  { id: "77777777-7777-7777-7777-777777777777", name: "#security-team", unread: 0, description: "Security Team", type: "team" as const, members: ["atlas", "widow", "themis", "triage"] },
  { id: "88888888-8888-8888-8888-888888888888", name: "#finance-team", unread: 0, description: "Finance Team", type: "team" as const, members: ["atlas", "kiyosaki", "simons", "mercury"] },
  { id: "99999999-9999-9999-9999-999999999999", name: "#sales-team", unread: 0, description: "Sales Team", type: "team" as const, members: ["atlas", "mercury", "vee", "echo", "haven"] },
  { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "#strategy-team", unread: 0, description: "Strategy Team", type: "team" as const, members: ["atlas", "drstrange", "themis", "kiyosaki"] },
  { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "#legal-team", unread: 0, description: "Legal Team", type: "team" as const, members: ["atlas", "themis"] },
  { id: "cccccccc-cccc-cccc-cccc-cccccccccccc", name: "#content-team", unread: 0, description: "Content Team", type: "team" as const, members: ["atlas", "ink", "vee", "echo", "aetherion"] },
  { id: "dddddddd-dddd-dddd-dddd-dddddddddddd", name: "#wellness-team", unread: 0, description: "Wellness Team", type: "team" as const, members: ["atlas", "selah", "prophets", "haven", "michael"] },
  { id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", name: "#studio-team", unread: 0, description: "Studio Team", type: "team" as const, members: ["atlas", "themaestro", "aetherion", "nova"] },
  { id: "ffffffff-ffff-ffff-ffff-ffffffffffff", name: "#creative-team", unread: 0, description: "Creative Team", type: "team" as const, members: ["atlas", "aetherion", "shuri", "nova", "ink"] },
  { id: "11111111-1111-1111-1111-111111111111", name: "#engineering-team", unread: 0, description: "Engineering Team", type: "team" as const, members: ["atlas", "shuri", "proximon", "triage", "nova"] },
];

/* ── DM Channel UUID Map (Supabase channel_id is UUID, not string) ── */
const DM_CHANNEL_MAP: Record<string, string> = {
  atlas: "aa000001-0000-0000-0000-000000000000",
  triage: "aa000002-0000-0000-0000-000000000000",
  shuri: "aa000003-0000-0000-0000-000000000000",
  proximon: "aa000004-0000-0000-0000-000000000000",
  aetherion: "aa000005-0000-0000-0000-000000000000",
  simons: "aa000006-0000-0000-0000-000000000000",
  mercury: "aa000007-0000-0000-0000-000000000000",
  vee: "aa000008-0000-0000-0000-000000000000",
  ink: "aa000009-0000-0000-0000-000000000000",
  echo: "aa000010-0000-0000-0000-000000000000",
  haven: "aa000011-0000-0000-0000-000000000000",
  widow: "aa000012-0000-0000-0000-000000000000",
  drstrange: "aa000013-0000-0000-0000-000000000000",
  kiyosaki: "aa000014-0000-0000-0000-000000000000",
  michael: "aa000015-0000-0000-0000-000000000000",
  selah: "aa000016-0000-0000-0000-000000000000",
  prophets: "aa000017-0000-0000-0000-000000000000",
  themaestro: "aa000018-0000-0000-0000-000000000000",
  nova: "aa000019-0000-0000-0000-000000000000",
  themis: "aa000020-0000-0000-0000-000000000000",
};
function getDmChannelId(agentId: string): string {
  return DM_CHANNEL_MAP[agentId] || agentId;
}

/* ── Reverse map: UUID → short agent ID (for resolving sender_agent_id from Supabase) ── */
const AGENT_UUID_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(DM_CHANNEL_MAP).map(([id, uuid]) => [uuid, id])
);
function resolveAgentId(uuidOrId: string): string {
  return AGENT_UUID_TO_ID[uuidOrId] || uuidOrId;
}

const DEFAULT_AGENTS = [
  { id: "atlas", name: "Atlas", role: "Operations Lead", status: "active", color: COLORS.agents.atlas, unread: 0 },
  { id: "triage", name: "Triage", role: "Debugging & Log Analysis", status: "idle", color: COLORS.agents.triage, unread: 0 },
  { id: "shuri", name: "Shuri", role: "Engineering & Code Gen", status: "active", color: COLORS.agents.shuri, unread: 2 },
  { id: "proximon", name: "Proximon", role: "Systems Architecture", status: "offline", color: COLORS.agents.proximon, unread: 0 },
  { id: "aetherion", name: "Aetherion", role: "Creative Director", status: "idle", color: COLORS.agents.aetherion, unread: 0 },
  { id: "simons", name: "Simons", role: "Data Analysis", status: "offline", color: COLORS.agents.simons, unread: 0 },
  { id: "mercury", name: "Mercury", role: "Sales Strategy", status: "active", color: COLORS.agents.mercury, unread: 1 },
  { id: "vee", name: "Vee", role: "Brand Strategy", status: "active", color: COLORS.agents.vee, unread: 0 },
  { id: "ink", name: "Ink", role: "Copywriting & Content", status: "idle", color: COLORS.agents.ink, unread: 0 },
  { id: "echo", name: "Echo", role: "Community Engagement", status: "idle", color: COLORS.agents.echo, unread: 0 },
  { id: "haven", name: "Haven", role: "Support & Onboarding", status: "offline", color: COLORS.agents.haven, unread: 0 },
  { id: "widow", name: "Widow", role: "Cybersecurity", status: "offline", color: COLORS.agents.widow, unread: 0 },
  { id: "drstrange", name: "Dr Strange", role: "Strategic Forecasting", status: "offline", color: COLORS.agents.drstrange, unread: 0 },
  { id: "kiyosaki", name: "Kiyosaki", role: "Financial Strategy", status: "offline", color: COLORS.agents.kiyosaki, unread: 0 },
  { id: "michael", name: "Michael", role: "Swim Coaching", status: "idle", color: COLORS.agents.michael, unread: 0 },
  { id: "selah", name: "Selah", role: "Psychology & Performance", status: "idle", color: COLORS.agents.selah, unread: 0 },
  { id: "prophets", name: "Prophets", role: "Spiritual Counsel", status: "idle", color: COLORS.agents.prophets, unread: 0 },
  { id: "themaestro", name: "TheMAESTRO", role: "Music Production", status: "idle", color: COLORS.agents.themaestro, unread: 0 },
  { id: "nova", name: "Nova", role: "Fabrication & Builds", status: "offline", color: COLORS.agents.nova, unread: 0 },
  { id: "themis", name: "Themis", role: "Governance & Rules", status: "active", color: COLORS.agents.themis, unread: 0 },
];

const DEFAULT_MESSAGES = [
  {
    id: "1",
    channelId: "mettle",
    type: "agent",
    sender: "Atlas",
    senderColor: COLORS.agents.atlas,
    content: "METTLE v5 design system is ready for review. Need Shuri to implement the dashboard components.",
    timestamp: "09:42 AM",
    date: "Today",
    reactions: [{ emoji: "thumbsup", count: 3 }, { emoji: "rocket", count: 2 }],
  },
  {
    id: "2",
    channelId: "mettle",
    type: "user",
    sender: "Ramon",
    content: "Perfect. Shuri, can you start on the athlete dashboard first? We need that for the Platinum group demo on Friday.",
    timestamp: "09:45 AM",
    date: "Today",
  },
  {
    id: "3",
    channelId: "mettle",
    type: "agent",
    sender: "Shuri",
    senderColor: COLORS.agents.shuri,
    content: "On it. I'll build the dashboard components with the new METTLE dark theme. Should have a prototype by EOD.",
    timestamp: "09:47 AM",
    date: "Today",
    reactions: [{ emoji: "zap", count: 5 }],
  },
  {
    id: "4",
    channelId: "mettle",
    type: "agent",
    sender: "Vee",
    senderColor: COLORS.agents.vee,
    content: "Marketing copy is ready. We're positioning METTLE as 'The Operating System for Elite Athletes' - thoughts?",
    timestamp: "09:52 AM",
    date: "Today",
  },
  {
    id: "5",
    channelId: "mettle",
    type: "user",
    sender: "Ramon",
    content: "Love it. That's exactly right. Keep that positioning consistent across all channels.",
    timestamp: "09:55 AM",
    date: "Today",
  },
  {
    id: "6",
    channelId: "dev",
    type: "agent",
    sender: "Proximon",
    senderColor: COLORS.agents.proximon,
    content: "Firestore real-time sync is implemented. Need to add offline fallback for athlete check-ins.",
    timestamp: "Yesterday 3:22 PM",
    date: "Yesterday",
  },
  {
    id: "7",
    channelId: "dev",
    type: "agent",
    sender: "Shuri",
    senderColor: COLORS.agents.shuri,
    content: "I'll handle the offline sync UI. Using IndexedDB for local storage with optimistic updates.",
    timestamp: "Yesterday 3:45 PM",
    date: "Yesterday",
  },
  {
    id: "8",
    channelId: "general",
    type: "agent",
    sender: "Atlas",
    senderColor: COLORS.agents.atlas,
    content: "Weekly sync at 2 PM today. Agenda: 1) METTLE launch timeline 2) Agent workload distribution 3) Q3 goals",
    timestamp: "Yesterday 10:15 AM",
    date: "Yesterday",
  },
  {
    id: "9",
    channelId: "dm-shuri",
    type: "agent",
    sender: "Shuri",
    senderColor: COLORS.agents.shuri,
    content: "The new component library is ready. Want me to deploy it to the staging environment?",
    timestamp: "Today 08:30 AM",
    date: "Today",
  },
  {
    id: "10",
    channelId: "dm-shuri",
    type: "user",
    sender: "Ramon",
    content: "Yes, deploy to staging. I'll review it this afternoon.",
    timestamp: "Today 08:35 AM",
    date: "Today",
  },
];

/* ── TYPES ──────────────────────────────────────────────────────────────────── */
type Channel = (typeof DEFAULT_CHANNELS)[0];
type Agent = (typeof DEFAULT_AGENTS)[0];
type Message = (typeof DEFAULT_MESSAGES)[0];
type ViewMode = "channel" | "dm";

/* ── HELPERS ────────────────────────────────────────────────────────────────── */
const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return COLORS.status.active;
    case "idle":
      return COLORS.status.idle;
    default:
      return COLORS.status.offline;
  }
};

const AGENT_TIERS: Record<string, { label: string; color: string }> = {
  atlas: { label: "APEX", color: "#f59e0b" },
  themis: { label: "APEX", color: "#f59e0b" },
  triage: { label: "PRO", color: "#a855f7" },
  proximon: { label: "PRO", color: "#a855f7" },
  aetherion: { label: "PRO", color: "#a855f7" },
  mercury: { label: "PRO", color: "#a855f7" },
  shuri: { label: "CORE", color: "#3b82f6" },
  simons: { label: "CORE", color: "#3b82f6" },
  drstrange: { label: "CORE", color: "#3b82f6" },
  vee: { label: "CORE", color: "#3b82f6" },
  ink: { label: "CORE", color: "#3b82f6" },
  haven: { label: "CORE", color: "#3b82f6" },
  nova: { label: "CORE", color: "#3b82f6" },
  kiyosaki: { label: "CORE", color: "#3b82f6" },
  themaestro: { label: "LOCAL", color: "#666666" },
  michael: { label: "LOCAL", color: "#666666" },
  prophets: { label: "LOCAL", color: "#666666" },
  selah: { label: "LOCAL", color: "#666666" },
  echo: { label: "LOCAL", color: "#666666" },
  widow: { label: "LOCAL", color: "#666666" },
};

const REACTION_MAP: Record<string, string> = {
  thumbsup: "+1",
  rocket: ">>",
  zap: "//",
  fire: "**",
  heart: "<3",
};

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function CommandCenterChatPage() {
  /* ── state ── */
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("channel");
  const [messageInput, setMessageInput] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ project: false, team: false, personal: false });
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const waitingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* ── file attachments ── */
  const [attachments, setAttachments] = useState<{ name: string; size: string; type: string; url: string }[]>([]);

  /* ── refs ── */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentsRef = useRef<Agent[]>(agents);

  /* ── mount + cleanup ── */
  useEffect(() => {
    setMounted(true);
    return () => {
      supabase?.removeAllChannels();
    };
  }, []);

  /* ── keep agentsRef in sync ── */
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  /* ── load data from Supabase on mount ── */
  useEffect(() => {
    const loadData = async () => {
      if (!supabase) {
        setActiveChannel(DEFAULT_CHANNELS[1]);
        setMessages(DEFAULT_MESSAGES);
        setLoading(false);
        return;
      }
      try {
        // Load channels
        const { data: channelsData } = await supabase
          .from("channels")
          .select("*")
          .order("last_activity_at", { ascending: false });

        if (channelsData && channelsData.length > 0) {
          const mapped = channelsData.map((ch: Record<string, unknown>) => ({
            id: ch.id as string,
            name: `#${(ch.slug as string) || (ch.name as string)}`,
            unread: 0,
            description: (ch.description as string) || "",
            active: false,
            type: ((ch.type as string) || "project") as "project" | "team",
            ...((ch.type === "team" && ch.members) ? { members: ch.members as string[] } : {}),
          }));
          // Merge: use Supabase channels + fill in missing types from defaults
          const hasTeam = mapped.some(c => c.type === "team");
          const hasProject = mapped.some(c => c.type === "project");
          const merged = [
            ...(hasProject ? [] : DEFAULT_CHANNELS.filter(c => c.type === "project")),
            ...mapped,
            ...(hasTeam ? [] : DEFAULT_CHANNELS.filter(c => c.type === "team")),
          ];
          setChannels(merged as Channel[]);
          setActiveChannel((mapped[0] || merged[0]) as Channel);
        } else {
          // Fallback to defaults if no Supabase data
          setActiveChannel(DEFAULT_CHANNELS[1]);
        }

        // Load agents - always keep all 20 from DEFAULT_AGENTS
        const { data: agentsData } = await supabase
          .from("agent_profiles")
          .select("*")
          .order("name");

        if (agentsData && agentsData.length > 0) {
          const supaMap = new Map(
            agentsData.map((a: Record<string, unknown>) => {
              const agentId = ((a.handle as string) || (a.name as string)?.toLowerCase() || (a.id as string)).toLowerCase();
              return [
                agentId,
                {
                  id: agentId,
                  name: a.name as string,
                  role: (a.role as string) || (a.handle as string) || "",
                  status: (a.status as string) || "offline",
                  color: (a.color_hex as string) || "#888",
                  unread: 0,
                },
              ];
            })
          );
          // Merge: Supabase data overrides defaults, but ALWAYS keep all 20 agents from DEFAULT_AGENTS
          const merged = DEFAULT_AGENTS.map((def) => {
            const supaData = supaMap.get(def.id.toLowerCase());
            return supaData || def;
          });
          setAgents(merged);
        } else {
          // No Supabase data - use all defaults
          setAgents(DEFAULT_AGENTS);
        }
      } catch (err) {
        console.error("Supabase load failed, using defaults:", err);
        // Fallback to defaults
        setActiveChannel(DEFAULT_CHANNELS[1]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  /* ── load messages when activeChannel/agent changes ── */
  useEffect(() => {
    if (!activeChannel && viewMode !== "dm") return;
    if (!supabase) {
      setMessages(DEFAULT_MESSAGES);
      return;
    }
    const sb = supabase;
    const channelId = viewMode === "dm" && activeAgent ? getDmChannelId(activeAgent.id) : activeChannel?.id;
    if (!channelId) return;
    const loadMessages = async () => {
      const { data } = await sb
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (data) {
        const mapped: Message[] = data.map((msg: Record<string, unknown>) => {
          const isUser = (msg.sender_type as string) === "user"
            || (msg.sender_user_id as string) === "00000000-0000-0000-0000-000000000001"
            || (msg.sender_agent_id as string) === "00000000-0000-0000-0000-000000000001";
          return {
            id: msg.id as string,
            channelId: msg.channel_id as string,
            type: isUser ? "user" as const : "agent" as const,
            sender: isUser ? "Ramon" : (agents.find((a) => a.id === resolveAgentId(msg.sender_agent_id as string))?.name || (viewMode === "dm" && activeAgent ? activeAgent.name : "Agent")),
            senderColor: isUser ? "#3B82F6" : (agents.find((a) => a.id === resolveAgentId(msg.sender_agent_id as string))?.color || (viewMode === "dm" && activeAgent ? activeAgent.color : "#888")),
            content: msg.content as string,
            timestamp: new Date(msg.created_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            date: "Today",
          };
        });
        setMessages(mapped);
      }
    };
    loadMessages();

    // No polling — realtime subscription handles live updates.
    // Polling caused duplicate messages and race conditions.
  }, [activeChannel, activeAgent, viewMode, agents]);

  /* ── real-time subscription for new messages ── */
  useEffect(() => {
    if (!supabase) return;
    if (!activeChannel && viewMode !== "dm") return;
    const sb = supabase;
    
    // Get the correct channel UUID for filtering
    const channelId = viewMode === "dm" && activeAgent ? getDmChannelId(activeAgent.id) : activeChannel?.id;
    if (!channelId) return;

    // Validate that channelId is a valid UUID format for Supabase filtering
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId);
    if (!isValidUUID) {
      console.warn(`Invalid UUID format for channel filter: ${channelId}. Subscription may not work correctly.`);
      return;
    }

    let subscription: ReturnType<typeof sb.channel> | null = null;
    
    try {
      // Create a unique channel name for this subscription
      const subscriptionChannelName = `chat-${viewMode === "dm" ? "dm" : "channel"}-${channelId}`;
      
      subscription = sb
        .channel(subscriptionChannelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => {
            console.log(`📨 Realtime INSERT for channel ${channelId}:`, payload.new);
            
            const msg = payload.new as Record<string, unknown>;
            const senderType = msg.sender_type as string | undefined;
            const agentId = resolveAgentId(msg.sender_agent_id as string);
            const agent = agentsRef.current.find((a) => a.id === agentId);

            // Check if this message belongs to our current view
            const msgChannelId = msg.channel_id as string;
            if (msgChannelId !== channelId) {
              console.log(`⚠️ Ignoring message for different channel: ${msgChannelId} (expected: ${channelId})`);
              return;
            }

            // Skip user messages — already shown optimistically
            if (senderType === "user") return;

            // Clear typing indicator when agent responds
            setWaitingForResponse(false);
            setTypingUsers([]);
            if (waitingTimeoutRef.current) {
              clearTimeout(waitingTimeoutRef.current);
              waitingTimeoutRef.current = null;
            }

            setMessages((prev) => {
              // Prevent duplicate messages
              if (prev.some((m) => m.id === (msg.id as string))) return prev;

              const newMessage = {
                id: msg.id as string,
                channelId: msgChannelId,
                type: "agent" as const,
                sender: agent?.name || (activeAgent?.name || "Agent"),
                senderColor: agent?.color || (activeAgent?.color || "#888"),
                content: msg.content as string,
                timestamp: new Date(msg.created_at as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                date: "Today",
              };

              return [...prev, newMessage];
            });
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log(`✅ Supabase Realtime subscription ACTIVE for ${viewMode === "dm" ? "DM with " + activeAgent?.name : "channel " + activeChannel?.name} (UUID: ${channelId})`);
          } else if (status === "CHANNEL_ERROR") {
            console.error(`❌ Supabase Realtime channel error for ${channelId}`);
          } else if (status === "TIMED_OUT") {
            console.warn(`⏰ Supabase Realtime timeout for ${channelId}`);
          } else if (status === "CLOSED") {
            console.log(`🔒 Supabase Realtime channel closed for ${channelId}`);
          }
        });
    } catch (err) {
      console.error("❌ Supabase Realtime subscription error:", err);
    }

    // Cleanup function: unsubscribe when channel/agent changes or component unmounts
    return () => {
      if (subscription) {
        console.log(`🧹 Cleaning up Supabase subscription for ${channelId}`);
        sb.removeChannel(subscription).then(() => {
          console.log(`✅ Successfully removed subscription for ${channelId}`);
        }).catch((err) => {
          console.warn(`⚠️ Error removing subscription for ${channelId}:`, err);
        });
      }
    };
  }, [activeChannel, activeAgent, viewMode]);

  /* ── scroll to bottom when messages change ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannel, activeAgent]);

  /* ── focus input on channel/agent change ── */
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeChannel, activeAgent]);

  /* ── typing indicator driven by waitingForResponse ── */
  useEffect(() => {
    if (waitingForResponse && viewMode === "dm" && activeAgent) {
      setTypingUsers([activeAgent.name]);
    } else {
      setTypingUsers([]);
    }
  }, [waitingForResponse, viewMode, activeAgent]);

  /* ── handlers ── */
  const handleChannelSelect = (channel: Channel) => {
    setActiveChannel(channel);
    setActiveAgent(null);
    setViewMode("channel");
    setThreadMessage(null);
    setSidebarOpen(false);
    setWaitingForResponse(false);
    setTypingUsers([]);
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
  };

  const handleAgentSelect = (agent: Agent) => {
    setActiveAgent(agent);
    setActiveChannel(null);
    setViewMode("dm");
    setThreadMessage(null);
    setSidebarOpen(false);
    setWaitingForResponse(false);
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() && attachments.length === 0) return;
    if (!activeChannel && !(viewMode === "dm" && activeAgent)) return;

    const content = attachments.length > 0
      ? `${messageInput}${messageInput ? "\n" : ""}${attachments.map((a) => `[${a.type === "image" ? "Image" : "File"}: ${a.name}]`).join(" ")}`
      : messageInput;

    // Always show user's message immediately
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      channelId: viewMode === "dm" && activeAgent ? getDmChannelId(activeAgent.id) : (activeChannel?.id || "22222222-2222-2222-2222-222222222222"),
      type: "user",
      sender: "Ramon",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: "Today",
    };
    setMessages((prev) => [...prev, newMessage]);

    // Persist to Supabase — bridge picks up new user messages via Realtime
    if (supabase) {
      const isDM = viewMode === "dm" && activeAgent;
      const targetChannelId = isDM ? getDmChannelId(activeAgent!.id) : (activeChannel?.id || "22222222-2222-2222-2222-222222222222");
      const { error } = await supabase.from("messages").insert({
        channel_id: targetChannelId,
        sender_user_id: "00000000-0000-0000-0000-000000000001",
        sender_type: "user",
        content: content.trim(),
        tenant_id: "11111111-1111-1111-1111-111111111111",
        attachments: [],
        metadata: {
          targetAgent: isDM ? activeAgent!.id : undefined,
          isDM: isDM,
          dmChannelId: isDM ? targetChannelId : undefined,
          channelName: isDM ? `DM: ${activeAgent!.name}` : (activeChannel?.name || "general"),
          source: "command-center-ui",
        },
      });
      if (error) console.error("Supabase send failed:", error);

      // Relay to agent via API so it actually responds
      const agentName = isDM ? activeAgent!.id : undefined;
      const channelName = isDM ? `DM: ${activeAgent!.name}` : (activeChannel?.name || "general");
      fetch("/api/command-center/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content.trim(),
          channelId: targetChannelId,
          agentName,
          channelName,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.response) {
            // Fallback: if realtime hasn't delivered after 2s, show the response directly
            setTimeout(() => {
              setMessages((prev) => {
                // Check if realtime already added a message after the user's last message
                const lastUserIdx = prev.findLastIndex((m) => m.type === "user");
                const hasAgentReply = prev.slice(lastUserIdx + 1).some((m) => m.type === "agent");
                if (hasAgentReply) return prev; // Realtime already delivered

                setWaitingForResponse(false);
                setTypingUsers([]);
                if (waitingTimeoutRef.current) {
                  clearTimeout(waitingTimeoutRef.current);
                  waitingTimeoutRef.current = null;
                }

                return [...prev, {
                  id: `api-${Date.now()}`,
                  channelId: targetChannelId,
                  type: "agent" as const,
                  sender: isDM ? activeAgent!.name : (data.agent || "Agent"),
                  senderColor: isDM ? (activeAgent!.color || "#888") : "#888",
                  content: data.response,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  date: "Today",
                }];
              });
            }, 2000);
          }
        })
        .catch((err) => console.error("Agent relay failed:", err));
    }

    setMessageInput("");
    setAttachments([]);

    if (viewMode === "dm" && activeAgent) {
      setWaitingForResponse(true);
      if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = setTimeout(() => {
        setWaitingForResponse(false);
        waitingTimeoutRef.current = null;
      }, 15000);
    }
  };

  const handleMessageClick = (message: Message) => {
    setThreadMessage(message);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments = Array.from(files).map((f) => ({
      name: f.name,
      size: f.size < 1024 ? `${f.size}B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)}KB` : `${(f.size / 1048576).toFixed(1)}MB`,
      type: f.type.startsWith("image/") ? "image" : "file",
      url: URL.createObjectURL(f),
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* ── filter messages ── */
  const filteredMessages = messages.filter((msg) => {
    if (viewMode === "dm" && activeAgent) {
      return msg.channelId === getDmChannelId(activeAgent.id);
    }
    return msg.channelId === activeChannel?.id;
  });

  /* ── group messages by date ── */
  const groupedMessages = filteredMessages.reduce(
    (groups, msg) => {
      const date = msg.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
      return groups;
    },
    {} as Record<string, Message[]>,
  );

  if (!mounted) return null;

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        background: COLORS.bg.main,
        color: COLORS.text.primary,
        fontFamily: FONT_FAMILY,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ═══════ TOP NAV BAR ═══════ */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          height: 48,
          flexShrink: 0,
          borderBottom: `1px solid ${COLORS.border.default}`,
          background: COLORS.bg.main,
          padding: "0 20px",
          gap: 4,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <a
          href="/command-center"
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: COLORS.text.secondary,
            textDecoration: "none",
            marginRight: 16,
          }}
        >
          COMMAND CENTER
        </a>
        {NAV.map((n) => (
          <a
            key={n.label}
            href={n.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: n.active ? COLORS.text.primary : COLORS.text.secondary,
              background: n.active ? `${COLORS.accent.purple}18` : "transparent",
              border: n.active ? `1px solid ${COLORS.accent.purple}40` : "1px solid transparent",
              textDecoration: "none",
              transition: "all 150ms ease",
            }}
          >
            <span style={{ fontSize: 10 }}>{n.icon}</span>
            {n.label}
          </a>
        ))}
      </nav>

      {/* ═══════ MAIN CONTENT (3 columns) ═══════ */}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          position: "relative",
        }}
      >

      {/* ═══════ MOBILE OVERLAY ═══════ */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 40,
          }}
        />
      )}

      {/* ═══════ LEFT SIDEBAR ═══════ */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          background: COLORS.bg.main,
          borderRight: `1px solid ${COLORS.border.default}`,
          position: sidebarOpen ? "fixed" : undefined,
          top: sidebarOpen ? 0 : undefined,
          left: sidebarOpen ? 0 : undefined,
          bottom: sidebarOpen ? 0 : undefined,
          zIndex: sidebarOpen ? 50 : undefined,
          transition: "transform 200ms ease",
          height: sidebarOpen ? "100vh" : "100%",
          minHeight: 0,
          overflow: "hidden",
        }}
        className={`chat-sidebar${sidebarOpen ? " open" : ""}`}
      >
        {/* ── Sidebar Header ── */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${COLORS.border.default}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `${COLORS.accent.purple}18`,
              border: `1px solid ${COLORS.accent.purple}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
              color: COLORS.accent.purple,
            }}
          >
            CC
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: COLORS.text.primary,
              }}
            >
              CHAT
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: COLORS.text.secondary,
              }}
            >
              COMMAND CENTER
            </div>
          </div>
        </div>

        {/* ── Scrollable channel sections ── */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
        {/* ── PROJECT CHATS Section ── */}
        <div style={{ padding: "16px 12px 8px", flexShrink: 0 }}>
          <div
            onClick={() => setCollapsedSections(s => ({ ...s, project: !s.project }))}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: collapsedSections.project ? 0 : 10,
              padding: "0 8px",
              cursor: "pointer",
              userSelect: "none" as const,
            }}
          >
            <div
              style={{
                height: 1,
                flex: 1,
                background: "linear-gradient(to right, rgba(124,58,237,0.2), transparent)",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.25em",
                color: COLORS.text.secondary,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 8, transition: "transform 150ms ease", transform: collapsedSections.project ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
              PROJECT CHATS
            </span>
            <div
              style={{
                height: 1,
                flex: 1,
                background: "linear-gradient(to left, rgba(124,58,237,0.2), transparent)",
              }}
            />
          </div>

          {!collapsedSections.project && <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {channels.filter((c) => c.type === "project").map((channel) => {
              const isActive = activeChannel?.id === channel.id && viewMode === "channel";
              return (
                <button
                  key={channel.id}
                  onClick={() => handleChannelSelect(channel)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                    transition: "all 150ms ease",
                    textAlign: "left" as const,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = COLORS.bg.hover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: COLORS.text.tertiary,
                        fontWeight: 500,
                      }}
                    >
                      #
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? COLORS.text.primary : COLORS.text.secondary,
                        transition: "color 150ms ease",
                      }}
                    >
                      {channel.name.slice(1)}
                    </span>
                  </div>
                  {channel.unread > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 10,
                        background: `${COLORS.accent.purple}20`,
                        color: COLORS.accent.purpleLight,
                        border: `1px solid ${COLORS.accent.purple}30`,
                        minWidth: 20,
                        textAlign: "center" as const,
                      }}
                    >
                      {channel.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>}
        </div>

        {/* ── TEAM CHATS Section ── */}
        <div style={{ padding: "8px 12px", flexShrink: 0 }}>
          <div
            onClick={() => setCollapsedSections(s => ({ ...s, team: !s.team }))}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: collapsedSections.team ? 0 : 10,
              padding: "0 8px",
              cursor: "pointer",
              userSelect: "none" as const,
            }}
          >
            <div
              style={{
                height: 1,
                flex: 1,
                background: "linear-gradient(to right, rgba(245,158,11,0.2), transparent)",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.25em",
                color: COLORS.text.secondary,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 8, transition: "transform 150ms ease", transform: collapsedSections.team ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
              TEAM CHATS
            </span>
            <div
              style={{
                height: 1,
                flex: 1,
                background: "linear-gradient(to left, rgba(245,158,11,0.2), transparent)",
              }}
            />
          </div>

          {!collapsedSections.team && <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {channels.filter((c) => c.type === "team").map((channel) => {
              const isActive = activeChannel?.id === channel.id && viewMode === "channel";
              return (
                <button
                  key={channel.id}
                  onClick={() => handleChannelSelect(channel)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                    transition: "all 150ms ease",
                    textAlign: "left" as const,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = COLORS.bg.hover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: COLORS.text.tertiary,
                        fontWeight: 500,
                      }}
                    >
                      #
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? COLORS.text.primary : COLORS.text.secondary,
                          transition: "color 150ms ease",
                          display: "block",
                        }}
                      >
                        {channel.name.slice(1)}
                      </span>
                      {"members" in channel && channel.members && (
                        <span
                          style={{
                            fontSize: 10,
                            color: COLORS.text.tertiary,
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          {channel.members.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  {channel.unread > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 10,
                        background: `${COLORS.accent.purple}20`,
                        color: COLORS.accent.purpleLight,
                        border: `1px solid ${COLORS.accent.purple}30`,
                        minWidth: 20,
                        textAlign: "center" as const,
                      }}
                    >
                      {channel.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>}
        </div>

        {/* ── Direct Messages Section ── */}
        <div style={{ padding: "8px 12px", flex: 1, overflowY: "auto", minHeight: 0 }}>
          <div
            onClick={() => setCollapsedSections(s => ({ ...s, personal: !s.personal }))}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: collapsedSections.personal ? 0 : 10,
              padding: "0 8px",
              flexShrink: 0,
              cursor: "pointer",
              userSelect: "none" as const,
            }}
          >
            <div
              style={{
                height: 1,
                flex: 1,
                background: "linear-gradient(to right, rgba(52,211,153,0.2), transparent)",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.25em",
                color: COLORS.text.secondary,
                textTransform: "uppercase" as const,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 8, transition: "transform 150ms ease", transform: collapsedSections.personal ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
              PERSONAL CHATS
            </span>
            <div
              style={{
                height: 1,
                flex: 1,
                background: "linear-gradient(to left, rgba(52,211,153,0.2), transparent)",
              }}
            />
          </div>

          {!collapsedSections.personal && <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {agents.map((agent) => {
              const isActive = activeAgent?.id === agent.id && viewMode === "dm";
              return (
                <button
                  key={agent.id}
                  onClick={() => handleAgentSelect(agent)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                    transition: "all 150ms ease",
                    textAlign: "left" as const,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = COLORS.bg.hover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Avatar with status dot */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: agent.color,
                        background: `${agent.color}15`,
                        border: `1px solid ${agent.color}30`,
                      }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        bottom: -1,
                        right: -1,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: getStatusColor(agent.status),
                        border: `2px solid ${COLORS.bg.main}`,
                        boxShadow: agent.status === "active" ? `0 0 6px ${getStatusColor(agent.status)}` : "none",
                      }}
                    />
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isActive ? COLORS.text.primary : COLORS.text.secondary,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap" as const,
                          transition: "color 150ms ease",
                        }}
                      >
                        {agent.name}
                      </span>
                      {AGENT_TIERS[agent.id] && (
                        <span
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            padding: "1px 4px",
                            borderRadius: 3,
                            background: `${AGENT_TIERS[agent.id].color}18`,
                            color: AGENT_TIERS[agent.id].color,
                            border: `1px solid ${AGENT_TIERS[agent.id].color}30`,
                            flexShrink: 0,
                          }}
                        >
                          {AGENT_TIERS[agent.id].label}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: COLORS.text.tertiary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {agent.role}
                    </div>
                    {(() => {
                      const dmChannelId = getDmChannelId(agent.id);
                      const lastMsg = [...messages].reverse().find((m) => m.channelId === dmChannelId);
                      if (!lastMsg) return null;
                      const preview = lastMsg.content.length > 30 ? lastMsg.content.slice(0, 30) + "..." : lastMsg.content;
                      return (
                        <div
                          style={{
                            fontSize: 10,
                            color: COLORS.text.tertiary,
                            opacity: 0.7,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap" as const,
                            marginTop: 2,
                          }}
                        >
                          {preview}
                        </div>
                      );
                    })()}
                  </div>
                  {/* Unread badge */}
                  {agent.unread > 0 && (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: `${agent.color}20`,
                        color: agent.color,
                        border: `1px solid ${agent.color}30`,
                        fontSize: 10,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {agent.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>}
        </div>

        </div>
        {/* ── User Profile ── */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${COLORS.border.default}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: `${COLORS.accent.purple}18`,
              border: `1px solid ${COLORS.accent.purple}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: COLORS.accent.purple,
            }}
          >
            R
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text.primary }}>
              Ramon
            </div>
            <div style={{ fontSize: 10, color: COLORS.text.tertiary }}>@ramiche</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: COLORS.status.active,
                boxShadow: `0 0 6px ${COLORS.status.active}`,
              }}
            />
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: COLORS.status.active,
              }}
            >
              ONLINE
            </span>
          </div>
        </div>
      </aside>

      {/* ═══════ CENTER PANEL — MESSAGES ═══════ */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        {/* ── Chat Header ── */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: `1px solid ${COLORS.border.default}`,
            background: "rgba(10,10,10,0.92)",
            backdropFilter: "blur(20px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="chat-mobile-menu"
              style={{
                display: "none",
                padding: 6,
                borderRadius: 6,
                border: `1px solid ${COLORS.border.default}`,
                background: COLORS.bg.card,
                cursor: "pointer",
                color: COLORS.text.secondary,
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {viewMode === "dm" && activeAgent ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${activeAgent.color}15`,
                    border: `1px solid ${activeAgent.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: activeAgent.color,
                    flexShrink: 0,
                  }}
                >
                  {activeAgent.name.charAt(0)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text.primary }}>
                    {activeAgent.name}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.text.secondary }}>{activeAgent.role}</div>
                </div>
              </div>
            ) : (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text.primary }}>
                  {activeChannel?.name || "Select a channel"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.text.secondary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {activeChannel?.description}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {/* Typing indicator */}
            {typingUsers.length > 0 && viewMode === "channel" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  color: COLORS.text.secondary,
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  {typingUsers.map((user) => {
                    const agentData = agents.find((a) => a.name === user);
                    return (
                      <div
                        key={user}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          marginLeft: -4,
                          border: `1.5px solid ${COLORS.bg.main}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9,
                          fontWeight: 700,
                          color: agentData?.color || COLORS.text.secondary,
                          background: `${agentData?.color || "#888"}15`,
                        }}
                      >
                        {user.charAt(0)}
                      </div>
                    );
                  })}
                </div>
                <span>
                  {typingUsers.length === 1 ? `${typingUsers[0]} is typing` : `${typingUsers.length} typing`}
                </span>
                <div style={{ display: "flex", gap: 3 }}>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: COLORS.text.tertiary, animation: "pulse 1.4s ease-in-out infinite" }} />
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: COLORS.text.tertiary, animation: "pulse 1.4s ease-in-out infinite", animationDelay: "0.2s" }} />
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: COLORS.text.tertiary, animation: "pulse 1.4s ease-in-out infinite", animationDelay: "0.4s" }} />
                </div>
              </div>
            )}
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: COLORS.text.secondary,
                padding: "4px 10px",
                borderRadius: 6,
                background: COLORS.bg.card,
                border: `1px solid ${COLORS.border.default}`,
              }}
            >
              {viewMode === "channel" ? "24 MEMBERS" : "DM"}
            </div>
          </div>
        </div>

        {/* ── Messages Container ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
          }}
        >
          {Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date Separator — matches command center section dividers */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "24px 0 16px",
                }}
              >
                <div
                  style={{
                    height: 1,
                    flex: 1,
                    background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)",
                  }}
                />
                <span
                  style={{
                    margin: "0 16px",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.25em",
                    color: COLORS.text.secondary,
                    textTransform: "uppercase" as const,
                  }}
                >
                  {date}
                </span>
                <div
                  style={{
                    height: 1,
                    flex: 1,
                    background: "linear-gradient(to left, transparent, rgba(255,255,255,0.06), transparent)",
                  }}
                />
              </div>

              {/* Messages for this date */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dateMessages.map((message) => (
                  <div
                    key={message.id}
                    onClick={() => handleMessageClick(message)}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "10px 12px",
                      borderRadius: 12,
                      cursor: "pointer",
                      transition: "background 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ flexShrink: 0 }}>
                      {message.type === "agent" ? (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            color: message.senderColor || COLORS.text.primary,
                            background: `${message.senderColor || "#888"}15`,
                            border: `1px solid ${message.senderColor || "#888"}30`,
                          }}
                        >
                          {message.sender.charAt(0)}
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: `${COLORS.accent.purple}18`,
                            border: `1px solid ${COLORS.accent.purple}40`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 700,
                            color: COLORS.accent.purple,
                          }}
                        >
                          R
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color:
                              message.type === "agent"
                                ? message.senderColor || COLORS.text.primary
                                : COLORS.text.primary,
                          }}
                        >
                          {message.sender}
                        </span>
                        {/* Clean — no badge, just the name */}
                        <span
                          style={{
                            fontSize: 10,
                            color: COLORS.text.tertiary,
                            fontFamily: "monospace",
                          }}
                        >
                          {message.timestamp}
                        </span>
                      </div>

                      {/* Body */}
                      <div
                        style={{
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: COLORS.text.primary,
                        }}
                      >
                        {message.content}
                      </div>

                      {/* Reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          {message.reactions.map((reaction, i) => (
                            <button
                              key={i}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: COLORS.bg.card,
                                border: `1px solid ${COLORS.border.default}`,
                                cursor: "pointer",
                                fontSize: 11,
                                color: COLORS.text.secondary,
                                transition: "all 150ms ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = COLORS.bg.card;
                                e.currentTarget.style.borderColor = COLORS.border.default;
                              }}
                            >
                              <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 600, color: COLORS.accent.purpleLight }}>
                                {REACTION_MAP[reaction.emoji] || reaction.emoji}
                              </span>
                              <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{reaction.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {typingUsers.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `${activeAgent?.color || "#888"}15`,
                  border: `1px solid ${activeAgent?.color || "#888"}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: activeAgent?.color || COLORS.text.secondary,
                }}
              >
                {typingUsers[0]?.charAt(0)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="typing-dot" style={{ animationDelay: "0s" }} />
                <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
                <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Message Input ── */}
        <div
          style={{
            padding: "12px 20px 16px",
            borderTop: `1px solid ${COLORS.border.default}`,
            flexShrink: 0,
          }}
        >
          {/* Attachment preview */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: COLORS.bg.card,
                    border: `1px solid ${COLORS.border.default}`,
                    fontSize: 12,
                  }}
                >
                  {att.type === "image" ? (
                    <img src={att.url} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }} />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.text.secondary} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  )}
                  <span style={{ color: COLORS.text.secondary, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
                  <span style={{ color: COLORS.text.tertiary, fontSize: 10 }}>{att.size}</span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.text.tertiary, padding: 2, fontSize: 14, lineHeight: 1 }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-end",
            }}
          >
            {/* Attach */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.md"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: 10,
                borderRadius: 10,
                background: COLORS.bg.card,
                border: `1px solid ${COLORS.border.default}`,
                cursor: "pointer",
                color: COLORS.text.secondary,
                flexShrink: 0,
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.color = COLORS.text.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.border.default;
                e.currentTarget.style.color = COLORS.text.secondary;
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            {/* Text area */}
            <div style={{ flex: 1, position: "relative" }}>
              <textarea
                ref={inputRef}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={`Message ${viewMode === "dm" ? activeAgent?.name : activeChannel?.name}...`}
                style={{
                  width: "100%",
                  background: COLORS.bg.card,
                  border: `1px solid ${COLORS.border.default}`,
                  borderRadius: 12,
                  padding: "10px 100px 10px 14px",
                  color: COLORS.text.primary,
                  fontSize: 13,
                  fontFamily: FONT_FAMILY,
                  resize: "none",
                  outline: "none",
                  minHeight: 44,
                  maxHeight: 200,
                  lineHeight: 1.5,
                  transition: "border-color 150ms ease",
                }}
                rows={1}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = `${COLORS.accent.purple}50`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = COLORS.border.default;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />

              {/* Inline actions */}
              <div
                style={{
                  position: "absolute",
                  right: 8,
                  bottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {["@", "#"].map((sym) => (
                  <button
                    key={sym}
                    style={{
                      padding: "4px 6px",
                      borderRadius: 4,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: COLORS.text.tertiary,
                      transition: "color 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = COLORS.text.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = COLORS.text.tertiary;
                    }}
                  >
                    {sym}
                  </button>
                ))}

                {/* Send Button — game-btn style */}
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="game-btn"
                  style={{
                    padding: "6px 16px",
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "monospace",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    borderRadius: 6,
                    border: `1px solid ${messageInput.trim() ? `${COLORS.accent.purple}50` : COLORS.border.default}`,
                    background: messageInput.trim() ? `${COLORS.accent.purple}18` : COLORS.bg.card,
                    color: messageInput.trim() ? COLORS.accent.purpleLight : COLORS.text.tertiary,
                    cursor: messageInput.trim() ? "pointer" : "not-allowed",
                    transition: "all 150ms ease",
                  }}
                >
                  SEND
                </button>
              </div>
            </div>
          </div>

          {/* Help text */}
          <div
            style={{
              marginTop: 8,
              paddingLeft: 52,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              color: COLORS.text.tertiary,
            }}
          >
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                background: COLORS.bg.card,
                border: `1px solid ${COLORS.border.default}`,
                fontFamily: "monospace",
                fontSize: 9,
              }}
            >
              Enter
            </span>
            <span>to send</span>
            <span style={{ color: COLORS.border.default }}>|</span>
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                background: COLORS.bg.card,
                border: `1px solid ${COLORS.border.default}`,
                fontFamily: "monospace",
                fontSize: 9,
              }}
            >
              Shift+Enter
            </span>
            <span>new line</span>
          </div>
        </div>
      </main>

      {/* ═══════ RIGHT PANEL — THREAD (COLLAPSIBLE) ═══════ */}
      {threadMessage && (
        <aside
          style={{
            width: 340,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            background: COLORS.bg.main,
            borderLeft: `1px solid ${COLORS.border.default}`,
            overflow: "hidden",
          }}
          className="chat-thread-panel"
        >
          {/* Thread Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${COLORS.border.default}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: `${COLORS.accent.purple}12`,
                  border: `1px solid ${COLORS.accent.purple}25`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: COLORS.accent.purpleLight,
                  fontSize: 12,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text.primary }}>Thread</div>
                <div style={{ fontSize: 10, color: COLORS.text.tertiary }}>Thread</div>
              </div>
            </div>
            <button
              onClick={() => setThreadMessage(null)}
              style={{
                padding: 6,
                borderRadius: 6,
                border: `1px solid ${COLORS.border.default}`,
                background: COLORS.bg.card,
                cursor: "pointer",
                color: COLORS.text.secondary,
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.color = COLORS.text.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.border.default;
                e.currentTarget.style.color = COLORS.text.secondary;
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Original Message */}
          <div style={{ padding: 16, borderBottom: `1px solid ${COLORS.border.default}` }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.25em",
                color: COLORS.text.secondary,
                marginBottom: 10,
                textTransform: "uppercase" as const,
              }}
            >
              Original Message
            </div>
            <div
              style={{
                background: COLORS.bg.card,
                border: `1px solid ${COLORS.border.default}`,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {threadMessage.type === "agent" ? (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: `${threadMessage.senderColor || "#888"}15`,
                      border: `1px solid ${threadMessage.senderColor || "#888"}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: threadMessage.senderColor || COLORS.text.primary,
                    }}
                  >
                    {threadMessage.sender.charAt(0)}
                  </div>
                ) : (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: `${COLORS.accent.purple}18`,
                      border: `1px solid ${COLORS.accent.purple}40`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: COLORS.accent.purple,
                    }}
                  >
                    R
                  </div>
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color:
                      threadMessage.type === "agent"
                        ? threadMessage.senderColor || COLORS.text.primary
                        : COLORS.text.primary,
                  }}
                >
                  {threadMessage.sender}
                </span>
                <span style={{ fontSize: 10, color: COLORS.text.tertiary, fontFamily: "monospace" }}>
                  {threadMessage.timestamp}
                </span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: COLORS.text.primary }}>
                {threadMessage.content}
              </div>
            </div>
          </div>

          {/* Thread Replies */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.25em",
                color: COLORS.text.secondary,
                marginBottom: 12,
                textTransform: "uppercase" as const,
              }}
            >
              Replies
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  color: COLORS.text.tertiary,
                  opacity: 0.5,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <div style={{ fontSize: 12, color: COLORS.text.tertiary, fontWeight: 500 }}>
                No replies yet
              </div>
              <div style={{ fontSize: 10, color: COLORS.text.tertiary, opacity: 0.6 }}>
                Be the first to reply
              </div>
            </div>
          </div>

          {/* Thread Reply Input */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${COLORS.border.default}` }}>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                placeholder="Reply to thread..."
                style={{
                  flex: 1,
                  background: COLORS.bg.card,
                  border: `1px solid ${COLORS.border.default}`,
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontFamily: FONT_FAMILY,
                  color: COLORS.text.primary,
                  resize: "none",
                  outline: "none",
                  minHeight: 38,
                  transition: "border-color 150ms ease",
                }}
                rows={1}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = `${COLORS.accent.purple}50`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = COLORS.border.default;
                }}
              />
              <button
                className="game-btn"
                style={{
                  padding: "8px 14px",
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  borderRadius: 6,
                  border: `1px solid ${COLORS.accent.purple}50`,
                  background: `${COLORS.accent.purple}18`,
                  color: COLORS.accent.purpleLight,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                  flexShrink: 0,
                }}
              >
                REPLY
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ═══════ RESPONSIVE STYLES ═══════ */}
      <style>{`
        @media (max-width: 767px) {
          .chat-sidebar {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            z-index: 50 !important;
            width: 280px !important;
            transform: translateX(-100%);
          }
          .chat-sidebar.open {
            transform: translateX(0) !important;
          }
          .chat-mobile-menu {
            display: flex !important;
          }
          .chat-thread-panel {
            position: fixed !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: 45 !important;
            width: 100% !important;
            max-width: 360px !important;
          }
        }
        @media (min-width: 768px) {
          .chat-sidebar {
            transform: translateX(0) !important;
          }
        }
        /* Scrollbar styling */
        div::-webkit-scrollbar {
          width: 4px;
        }
        div::-webkit-scrollbar-track {
          background: transparent;
        }
        div::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 2px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.14);
        }
        textarea::placeholder {
          color: ${COLORS.text.tertiary};
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${COLORS.text.secondary};
          animation: typingBounce 1.4s ease-in-out infinite;
          display: inline-block;
        }
      `}</style>
      </div>
    </div>
  );
}
