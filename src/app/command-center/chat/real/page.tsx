// /Users/admin/ramiche-site/src/app/command-center/chat/real/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/* ══════════════════════════════════════════════════════════════════════════════
   COMMAND CENTER CHAT — Supabase Real‑time
   Connected to Supabase tables with real‑time WebSocket subscriptions
   ══════════════════════════════════════════════════════════════════════════════ */

// Types matching Supabase schema
type Agent = {
  id: string;
  name: string;
  handle: string;
  status: "active" | "idle" | "offline";
  color_hex: string;
  avatar_url?: string;
};

type Channel = {
  id: string;
  name: string;
  slug: string;
  type: "channel" | "dm" | "project";
  description?: string;
  last_activity_at: string;
};

type Message = {
  id: string;
  channel_id: string;
  sender_agent_id: string | null;
  sender_user_id: string | null;
  sender_type?: string;
  content: string;
  attachments: { url: string; name: string; type: string }[];
  created_at: string;
  metadata?: Record<string, string | number | boolean>;
  agent?: Agent;
};

export default function CommandCenterRealChat() {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial data (mount-only; helpers close over latest supabase client)
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    loadInitialData();
    setupRealtimeSubscriptions();

    return () => {
      supabase?.removeAllChannels();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only bootstrap
  }, []);

  const loadInitialData = async () => {
    if (!supabase) return;
    try {
      const { data: channelsData } = await supabase
        .from("channels")
        .select("*")
        .order("last_activity_at", { ascending: false });

      if (channelsData && channelsData.length > 0) {
        setChannels(channelsData);
        setActiveChannel(channelsData[0]);
      }

      const { data: agentsData } = await supabase
        .from("agent_profiles")
        .select("*")
        .order("name");

      if (agentsData) {
        setAgents(agentsData);
      }

      if (channelsData?.[0]) {
        await loadMessages(channelsData[0].id);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (channelId: string) => {
    if (!supabase) return;
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
    if (!supabase) return;
    // Subscribe to new messages (teardown: supabase.removeAllChannels in effect cleanup)
    supabase
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
          // Only add if for current channel
          if (!activeChannel || newMessage.channel_id !== activeChannel.id) return;
          
          // Enrich with agent data
          const agent = agents.find(a => a.id === newMessage.sender_agent_id);
          setMessages(prev => [...prev, { ...newMessage, agent }]);
          scrollToBottom();
        }
      )
      .subscribe();

    // Subscribe to channel activity updates
    supabase
      .channel("channels")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "channels",
        },
        (payload) => {
          const updatedChannel = payload.new as Channel;
          setChannels(prev => 
            prev.map(ch => ch.id === updatedChannel.id ? updatedChannel : ch)
          );
        }
      )
      .subscribe();
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !activeChannel || !supabase) return;

    const { error } = await supabase.from("messages").insert({
      channel_id: activeChannel.id,
      sender_user_id: "00000000-0000-0000-0000-000000000001",
      sender_type: "user",
      content: messageInput.trim(),
      tenant_id: "11111111-1111-1111-1111-111111111111",
      attachments: [],
      metadata: {
        targetAgent: "atlas",
        channelName: activeChannel.name || "general",
        source: "command-center-ui",
      },
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

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--ink-1)", color: "var(--t-hi)", fontFamily: "var(--f-display)" }}>
        <div className="text-center max-w-md">
          <div className="text-xl mb-2" style={{ fontFamily: "var(--f-tech)", letterSpacing: "0.04em" }}>Supabase not configured</div>
          <div className="text-sm" style={{ color: "var(--t-mid)" }}>
            Set <code style={{ color: "var(--accent)", fontFamily: "var(--f-mono)" }}>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code style={{ color: "var(--accent)", fontFamily: "var(--f-mono)" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable real-time chat.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ink-1)", color: "var(--t-hi)", fontFamily: "var(--f-display)" }}>
        <div className="text-center">
          <div className="text-xl mb-2" style={{ fontFamily: "var(--f-tech)", letterSpacing: "0.04em" }}>Loading Command Center Chat...</div>
          <div style={{ color: "var(--t-mid)" }}>Connecting to Supabase Realtime</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--ink-1)", color: "var(--t-hi)", fontFamily: "var(--f-display)" }}>
      {/* Sidebar - Channels */}
      <div className="w-64 p-4" style={{ borderRight: "1px solid var(--line)" }}>
        <div className="text-sm mb-4 eyebrow" style={{ color: "var(--t-mid)", fontFamily: "var(--f-mono)", letterSpacing: "0.16em" }}>CHANNELS</div>
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="p-3 rounded-lg mb-1 cursor-pointer transition-colors"
            style={
              activeChannel?.id === channel.id
                ? { background: "color-mix(in oklab, var(--accent) 14%, transparent)", border: "1px solid color-mix(in oklab, var(--accent) 38%, transparent)" }
                : { border: "1px solid transparent" }
            }
            onClick={() => {
              setActiveChannel(channel);
              loadMessages(channel.id);
            }}
          >
            <div className="font-medium">{channel.name}</div>
            <div className="text-sm" style={{ color: "var(--t-mid)" }}>{channel.description}</div>
          </div>
        ))}
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4" style={{ borderBottom: "1px solid var(--line)" }}>
          {activeChannel && (
            <>
              <div className="text-xl font-bold" style={{ fontFamily: "var(--f-tech)", letterSpacing: "0.04em" }}>#{activeChannel.name}</div>
              <div className="text-sm" style={{ color: "var(--t-mid)" }}>{activeChannel.description}</div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => {
            const isUser = msg.sender_type === "user" || msg.sender_user_id === "00000000-0000-0000-0000-000000000001";
            const senderName = isUser ? "Ramon" : (msg.agent?.name || "Unknown");
            const senderColor = isUser ? "var(--c-cyan)" : msg.agent?.color_hex;
            return (
            <div key={msg.id} className="flex gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: isUser ? "color-mix(in oklab, var(--c-cyan) 20%, var(--ink-0))" : "var(--ink-3)", color: "var(--t-hi)" }}>
                {senderName.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold" style={{ color: senderColor }}>
                    {senderName}
                  </span>
                  <span className="text-xs" style={{ color: "var(--t-lo)", fontFamily: "var(--f-mono)" }}>
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="whitespace-pre-wrap" style={{ color: "var(--t-hi)" }}>{msg.content}</div>
              </div>
            </div>
          );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="flex gap-2">
            <textarea
              className="flex-1 rounded-lg p-3 resize-none focus:outline-none"
              style={{ background: "var(--panel-glass)", border: "1px solid var(--line-2)", color: "var(--t-hi)" }}
              placeholder="Message #channel"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              rows={2}
            />
            <button
              className="text-white px-6 rounded-lg font-medium transition-colors"
              style={{ background: "linear-gradient(135deg, var(--c-purple-l), var(--c-purple))", boxShadow: "var(--glow)" }}
              onClick={sendMessage}
            >
              Send
            </button>
          </div>
          <div className="text-xs mt-2" style={{ color: "var(--t-lo)", fontFamily: "var(--f-mono)" }}>
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>

      {/* Sidebar - Agents */}
      <div className="w-64 p-4" style={{ borderLeft: "1px solid var(--line)" }}>
        <div className="text-sm mb-4 eyebrow" style={{ color: "var(--t-mid)", fontFamily: "var(--f-mono)", letterSpacing: "0.16em" }}>AGENTS ONLINE</div>
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center gap-3 p-2 rounded" style={{ transition: "background 150ms ease" }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: agent.color_hex + "30", color: agent.color_hex }}
            >
              {agent.name.charAt(0)}
            </div>
            <div>
              <div className="font-medium">{agent.name}</div>
              <div className="text-xs" style={{ color: "var(--t-mid)" }}>@{agent.handle}</div>
            </div>
            <div className="ml-auto">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: agent.status === "active" ? "var(--c-green)" :
                                  agent.status === "idle" ? "var(--c-amber)" : "var(--t-dim)"
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}