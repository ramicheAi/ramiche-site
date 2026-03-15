// /Users/admin/ramiche-site/src/app/command-center/chat/real/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase as _supabase } from "@/lib/supabase";
const supabase = _supabase!;

/* ══════════════════════════════════════════════════════════════════════════════
   COMMAND CENTER CHAT — Supabase Real‑time
   Connected to Supabase tables with real‑time WebSocket subscriptions
   ══════════════════════════════════════════════════════════════════════════════ */

// Design tokens (copy from original)
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
  },
};

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
  attachments: any[];
  created_at: string;
  metadata?: Record<string, any>;
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

  // Load initial data
  useEffect(() => {
    loadInitialData();
    setupRealtimeSubscriptions();

    return () => {
      // Cleanup subscriptions
      supabase?.removeAllChannels();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      // Load channels
      const { data: channelsData } = await supabase
        .from("channels")
        .select("*")
        .order("last_activity_at", { ascending: false });

      if (channelsData && channelsData.length > 0) {
        setChannels(channelsData);
        setActiveChannel(channelsData[0]);
      }

      // Load agents
      const { data: agentsData } = await supabase
        .from("agent_profiles")
        .select("*")
        .order("name");

      if (agentsData) {
        setAgents(agentsData);
      }

      // Load messages for active channel
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
    // Subscribe to new messages
    const messagesSubscription = supabase
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
    const channelsSubscription = supabase
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
    if (!messageInput.trim() || !activeChannel) return;

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">Loading Command Center Chat...</div>
          <div className="text-gray-400">Connecting to Supabase Realtime</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar - Channels */}
      <div className="w-64 border-r border-gray-900 p-4">
        <div className="text-sm text-gray-400 mb-4">CHANNELS</div>
        {channels.map((channel) => (
          <div
            key={channel.id}
            className={`p-3 rounded-lg mb-1 cursor-pointer transition-colors ${
              activeChannel?.id === channel.id
                ? "bg-purple-900/20 border border-purple-800/30"
                : "hover:bg-gray-900"
            }`}
            onClick={() => {
              setActiveChannel(channel);
              loadMessages(channel.id);
            }}
          >
            <div className="font-medium">{channel.name}</div>
            <div className="text-sm text-gray-400">{channel.description}</div>
          </div>
        ))}
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-900 p-4">
          {activeChannel && (
            <>
              <div className="text-xl font-bold">#{activeChannel.name}</div>
              <div className="text-sm text-gray-400">{activeChannel.description}</div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => {
            const isUser = msg.sender_type === "user" || msg.sender_user_id === "00000000-0000-0000-0000-000000000001";
            const senderName = isUser ? "Ramon" : (msg.agent?.name || "Unknown");
            const senderColor = isUser ? "#3B82F6" : msg.agent?.color_hex;
            return (
            <div key={msg.id} className="flex gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: isUser ? "#1E3A5F" : "#1F2937" }}>
                {senderName.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold" style={{ color: senderColor }}>
                    {senderName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-200 whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-900 p-4">
          <div className="flex gap-2">
            <textarea
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-3 text-white resize-none focus:outline-none focus:border-purple-600"
              placeholder="Message #channel"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              rows={2}
            />
            <button
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 rounded-lg font-medium transition-colors"
              onClick={sendMessage}
            >
              Send
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>

      {/* Sidebar - Agents */}
      <div className="w-64 border-l border-gray-900 p-4">
        <div className="text-sm text-gray-400 mb-4">AGENTS ONLINE</div>
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center gap-3 p-2 hover:bg-gray-900 rounded">
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
                style={{ 
                  backgroundColor: agent.status === "active" ? "#10B981" : 
                                  agent.status === "idle" ? "#F59E0B" : "#6B7280" 
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}