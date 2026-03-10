// /Users/admin/ramiche-site/src/app/command-center/chat/page.tsx - SUPABASE INTEGRATED VERSION
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/* ══════════════════════════════════════════════════════════════════════════════
   COMMAND CENTER CHAT — Unified Design Language
   Three-column real-time chat interface for agent coordination
   NOW WITH SUPABASE REAL‑TIME INTEGRATION
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
  },
  status: {
    active: "#10B981",
    idle: "#F59E0B",
    offline: "#6B7280",
  },
};

/* ── TYPES (adapted to Supabase schema) ───────────────────────────────────── */
interface Agent {
  id: string;
  name: string;
  handle: string;
  model?: string;
  status: "active" | "idle" | "offline" | "busy";
  color_hex: string;
  avatar_url?: string;
  skills: string[];
}

interface Channel {
  id: string;
  name: string;
  slug: string;
  type: "channel" | "dm" | "project";
  description?: string;
  is_private: boolean;
  last_activity_at: string;
}

interface Message {
  id: string;
  channel_id: string;
  sender_agent_id: string | null;
  sender_user_id: string | null;
  content: string;
  attachments: any[];
  created_at: string;
  is_edited?: boolean;
  is_pinned?: boolean;
  agent?: Agent; // Enriched client-side
}

type ViewMode = "channel" | "dm";

/* ── MOCK DATA (fallback while loading) ──────────────────────────────────── */
const MOCK_AGENTS: Agent[] = [
  { id: "atlas", name: "Atlas", handle: "atlas", status: "active", color_hex: COLORS.agents.atlas, skills: ["coordination", "strategy"] },
  { id: "proximon", name: "Proximon", handle: "proximon", status: "active", color_hex: COLORS.agents.proximon, skills: ["architecture", "systems"] },
];

const MOCK_CHANNELS: Channel[] = [
  { id: "general", name: "General", slug: "general", type: "channel", description: "Main discussion channel", is_private: false, last_activity_at: new Date().toISOString() },
  { id: "mettle", name: "METTLE", slug: "mettle", type: "channel", description: "Apex Athlete development", is_private: false, last_activity_at: new Date().toISOString() },
];

/* ── HELPERS ──────────────────────────────────────────────────────────────── */
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
  const [channels, setChannels] = useState<Channel[]>(MOCK_CHANNELS);
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ── effects ── */
  useEffect(() => {
    setMounted(true);
    loadInitialData();
    setupRealtimeSubscriptions();

    return () => {
      supabase.removeAllChannels();
    };
  }, []);

  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel.id);
    }
  }, [activeChannel]);

  /* ── Supabase integration ── */
  const loadInitialData = async () => {
    try {
      // Load channels from Supabase
      const { data: channelsData } = await supabase
        .from("channels")
        .select("*")
        .order("last_activity_at", { ascending: false });

      if (channelsData && channelsData.length > 0) {
        setChannels(channelsData);
        setActiveChannel(channelsData[0]);
      }

      // Load agents from Supabase
      const { data: agentsData } = await supabase
        .from("agent_profiles")
        .select("*")
        .order("name");

      if (agentsData) {
        const formattedAgents: Agent[] = agentsData.map(a => ({
          id: a.id,
          name: a.name,
          handle: a.handle,
          status: a.status,
          color_hex: a.color_hex,
          avatar_url: a.avatar_url,
          skills: a.skills || [],
        }));
        setAgents(formattedAgents);
        setActiveAgent(formattedAgents[0] || null);
      }
    } catch (error) {
      console.error("Failed to load Supabase data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (channelId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (data) {
      // Enrich messages with agent data
      const enriched = data.map(msg => ({
        ...msg,
        agent: agents.find(a => a.id === msg.sender_agent_id),
      }));
      setMessages(enriched);
      scrollToBottom();
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Messages subscription
    const messagesSub = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (!activeChannel || newMessage.channel_id !== activeChannel.id) return;
          
          const agent = agents.find(a => a.id === newMessage.sender_agent_id);
          setMessages(prev => [...prev, { ...newMessage, agent }]);
          scrollToBottom();
        }
      )
      .subscribe();

    // Channel activity updates
    const channelsSub = supabase
      .channel("channels")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "channels",
        },
        (payload) => {
          const updated = payload.new as Channel;
          setChannels(prev => 
            prev.map(ch => ch.id === updated.id ? updated : ch)
          );
          if (activeChannel?.id === updated.id) {
            setActiveChannel(updated);
          }
        }
      )
      .subscribe();
  };

  /* ── UI helpers ── */
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !activeChannel || !activeAgent) return;

    const { error } = await supabase.from("messages").insert({
      channel_id: activeChannel.id,
      sender_agent_id: activeAgent.id,
      content: messageInput.trim(),
      tenant_id: "11111111-1111-1111-1111-111111111111",
      attachments: [],
    });

    if (error) {
      console.error("Failed to send message:", error);
      return;
    }

    setMessageInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ── UI rendering (preserving Shuri's design) ── */
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">Loading Command Center...</div>
          <div className="text-gray-400">Connecting to Supabase Realtime</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Channels sidebar */}
      <div className={`${sidebarOpen ? "block" : "hidden"} md:block w-64 md:w-80 border-r border-gray-900 p-4`}>
        <div className="text-sm text-gray-400 mb-4">CHANNELS</div>
        {channels.map((channel) => (
          <div
            key={channel.id}
            className={`p-3 rounded-lg mb-1 cursor-pointer transition-colors ${
              activeChannel?.id === channel.id
                ? "bg-purple-900/20 border border-purple-800/30"
                : "hover:bg-gray-900"
            }`}
            onClick={() => setActiveChannel(channel)}
          >
            <div className="font-medium">#{channel.name}</div>
            <div className="text-sm text-gray-400">{channel.description}</div>
          </div>
        ))}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-900 p-4 flex items-center justify-between">
          <div>
            <div className="text-xl font-bold">
              {activeChannel ? `#${activeChannel.name}` : "Select a channel"}
            </div>
            <div className="text-sm text-gray-400">
              {activeChannel?.description || "Supabase real‑time chat"}
            </div>
          </div>
          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ 
                  backgroundColor: msg.agent?.color_hex + "30", 
                  color: msg.agent?.color_hex 
                }}
              >
                {msg.agent?.name?.charAt(0) || "?"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold">{msg.agent?.name || "Unknown"}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-200 whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-900 p-4">
          <div className="flex gap-2">
            <textarea
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-3 text-white resize-none focus:outline-none focus:border-purple-600"
              placeholder={`Message #${activeChannel?.name || "channel"}`}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              rows={2}
            />
            <button
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 rounded-lg font-medium transition-colors"
              onClick={sendMessage}
              disabled={!messageInput.trim()}
            >
              Send
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line • Connected to Supabase
          </div>
        </div>
      </div>

      {/* Agents sidebar */}
      <div className="hidden md:block w-64 border-l border-gray-900 p-4">
        <div className="text-sm text-gray-400 mb-4">AGENTS ONLINE</div>
        {agents.map((agent) => (
          <div 
            key={agent.id} 
            className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
              activeAgent?.id === agent.id ? "bg-gray-900" : "hover:bg-gray-900"
            }`}
            onClick={() => setActiveAgent(agent)}
          >
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: agent.color_hex + "30", color: agent.color_hex }}
            >
              {agent.name.charAt(0)}
            </div>
            <div>
              <div className="font-medium">{agent.name}</div>
              <div className="text-xs text-gray-400">@{agent.handle}</div>
            </div>
            <div className="ml-auto">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getStatusColor(agent.status) }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}