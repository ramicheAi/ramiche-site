"use client";

import { useState, useEffect, useRef } from "react";
import AgentMessagePreview, { StreamingAgentMessage } from "@/components/chat/AgentMessagePreview";
import { BentoGrid, AthleteStatsCard, ProgressCard, MetricCard, ActionCard } from "@/components/athlete/BentoDashboard";
import { ThemeToggle } from "@/components/theme/ThemeProvider";

/* ══════════════════════════════════════════════════════════════════════════════
   COMMAND CENTER CHAT — Modern 2026 Implementation
   AI Elements JSXPreview + CSS content-visibility + Bento grid + Adaptive themes
   ══════════════════════════════════════════════════════════════════════════════ */

const COLORS = {
  bg: {
    main: "#0e0e18", // Off-black for reduced eye strain
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
    primary: "#f8fafc", // Off-white
    secondary: "#94a3b8",
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
  }
};

const CHANNELS = [
  { id: "22222222-2222-2222-2222-222222222222", name: "#general", unread: 3 },
  { id: "33333333-3333-3333-3333-333333333333", name: "#mettle", unread: 12 },
  { id: "55555555-5555-5555-5555-555555555555", name: "#verified-agents", unread: 0 },
];

const AGENTS = [
  { id: "atlas", name: "Atlas", role: "Operations Lead", status: "active", color: COLORS.agents.atlas },
  { id: "shuri", name: "Shuri", role: "Creative Coding", status: "active", color: COLORS.agents.shuri },
  { id: "vee", name: "Vee", role: "Brand & Marketing", status: "active", color: COLORS.agents.vee },
];

export default function ModernChatPage() {
  const [activeChannel, setActiveChannel] = useState(CHANNELS[1]);
  const [activeAgent, setActiveAgent] = useState<(typeof AGENTS)[0]>(AGENTS[0]);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<{ id: string; type: string; sender: string; senderColor?: string; content: string; timestamp: string }[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [relayError, setRelayError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    const text = messageInput.trim();
    if (!text || sending) return;

    const newMessage = {
      id: `msg-${Date.now()}`,
      type: "user",
      sender: "Ramon",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessageInput("");
    setRelayError(null);
    setSending(true);
    setTypingUsers([activeAgent.name]);

    void fetch("/api/command-center/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        channelId: activeChannel.id,
        agentName: activeAgent.id,
        channelName: activeChannel.name,
      }),
    })
      .then(async (r) => {
        let data: { ok?: boolean; response?: string; error?: string; source?: string } = {};
        try {
          data = await r.json();
        } catch {
          /* non-JSON body */
        }
        setTypingUsers([]);
        setSending(false);
        if (!r.ok) {
          setRelayError(data.error || `Chat relay failed (${r.status})`);
          return;
        }
        if (data.ok && data.response) {
          const replyMessage = {
            id: `reply-${Date.now()}`,
            type: "agent",
            sender: activeAgent.name,
            senderColor: activeAgent.color,
            content: data.response,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, replyMessage]);
        } else {
          setRelayError(data.error || `Chat relay failed (${r.status})`);
        }
      })
      .catch(() => {
        setTypingUsers([]);
        setSending(false);
        setRelayError("Network error — could not reach /api/command-center/chat");
      });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--ink-1)", color: "var(--t-hi)", fontFamily: "var(--f-display)" }}>
      {/* Sidebar */}
      <div className="w-60 flex flex-col" style={{ background: "var(--ink-2)", borderRight: "1px solid var(--line-2)" }}>
        <div className="p-4" style={{ borderBottom: "1px solid var(--line-2)" }}>
          <div className="font-bold text-lg" style={{ color: "var(--accent)", fontFamily: "var(--f-tech)", letterSpacing: "0.08em" }}>COMMAND</div>
          <div className="text-xs" style={{ color: "var(--t-mid)" }}>Modern Chat</div>
        </div>

        <div className="p-4">
          <ThemeToggle />
        </div>

        <div className="p-4" style={{ borderBottom: "1px solid var(--line-2)" }}>
          <div className="text-xs font-bold mb-3 eyebrow" style={{ color: "var(--t-mid)", fontFamily: "var(--f-mono)", letterSpacing: "0.16em" }}>CHANNELS</div>
          {CHANNELS.map(channel => (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel)}
              className="w-full px-3 py-2 rounded-lg text-sm transition-all text-left"
              style={
                activeChannel.id === channel.id
                  ? { background: "color-mix(in oklab, var(--accent) 14%, transparent)", color: "var(--t-hi)" }
                  : { color: "var(--t-mid)" }
              }
            >
              {channel.name}
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className="text-xs font-bold mb-3 eyebrow" style={{ color: "var(--t-mid)", fontFamily: "var(--f-mono)", letterSpacing: "0.16em" }}>AGENTS</div>
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent)}
              className="w-full flex items-center gap-3 p-2 rounded-lg transition-colors"
              style={
                activeAgent.id === agent.id
                  ? { background: "color-mix(in oklab, var(--accent) 12%, transparent)" }
                  : undefined
              }
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: `${agent.color}40` }}
              >
                {agent.name.charAt(0)}
              </div>
              <div className="text-sm font-semibold" style={{ color: "var(--t-hi)" }}>
                {agent.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Dashboard Header */}
        <div className="p-4" style={{ borderBottom: "1px solid var(--line-2)" }}>
          <BentoGrid>
            <AthleteStatsCard 
              title="Active Agents"
              value={AGENTS.filter(a => a.status === "active").length}
              change="+2 this week"
              icon="⚡"
              color="purple"
            />
            <ProgressCard 
              title="Message Delivery"
              progress={95}
              color="blue"
              details="Supabase real-time"
            />
            <MetricCard 
              title="Response Time"
              metric={1.2}
              trend="up"
              color="green"
              format="duration"
            />
            <ActionCard 
              title="Enable JSXPreview"
              description="Activate AI Elements 1.9 streaming for all agent messages"
              action="Configure"
              color="cyan"
              onClick={() => console.log("JSXPreview enabled")}
            />
          </BentoGrid>
        </div>

        {/* Messages Container */}
        <div 
          className="flex-1 overflow-y-auto p-4"
          style={{
            contentVisibility: "auto",
            containIntrinsicSize: "0 2000px",
            scrollBehavior: "smooth"
          }}
        >
          <div className="space-y-6">
            {/* User messages */}
            {messages.filter(m => m.type === "user").map(message => (
              <div key={message.id} className="flex justify-end">
                <div className="rounded-2xl rounded-br-none p-4 max-w-[70%]" style={{ background: "linear-gradient(135deg, var(--c-purple-l), var(--c-purple))", boxShadow: "var(--glow)" }}>
                  <div className="text-white text-sm">{message.content}</div>
                  <div className="text-white/60 text-xs mt-1" style={{ fontFamily: "var(--f-mono)" }}>{message.timestamp}</div>
                </div>
              </div>
            ))}

            {/* Agent messages with JSXPreview */}
            {messages.filter(m => m.type === "agent").map(message => (
              <div key={message.id} className="flex gap-3">
                <AgentMessagePreview
                  agentName={message.sender}
                  agentColor={message.senderColor ?? COLORS.agents.atlas}
                  initialContent={message.content}
                  streaming={false}
                  onAction={(action) => {
                    console.log(`Agent ${message.sender} action: ${action}`);
                    // Trigger agent workflow
                  }}
                />
              </div>
            ))}

            {/* Streaming demo */}
            {typingUsers.length > 0 && (
              <StreamingAgentMessage agentName={typingUsers[0]} agentColor={activeAgent.color} />
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4" style={{ borderTop: "1px solid var(--line-2)", background: "var(--ink-2)" }}>
          {relayError && (
            <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid color-mix(in oklab, var(--c-red) 40%, transparent)", background: "color-mix(in oklab, var(--c-red) 14%, transparent)", color: "color-mix(in oklab, var(--c-red) 70%, var(--t-hi))" }}>
              {relayError}
            </div>
          )}
          <div className="flex gap-3">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={`Message ${activeChannel.name} (${activeAgent.name})...`}
              disabled={sending}
              className="flex-1 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none min-h-[44px] disabled:opacity-50"
              style={{ background: "var(--panel-glass)", border: "1px solid var(--line-2)", color: "var(--t-hi)" }}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sending}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
              style={
                messageInput.trim() && !sending
                  ? { background: "linear-gradient(135deg, var(--c-purple-l), var(--c-purple))", color: "#fff", boxShadow: "var(--glow)" }
                  : { background: "var(--ink-3)", color: "var(--t-lo)", cursor: "not-allowed" }
              }
            >
              {sending ? "…" : "Send"}
            </button>
          </div>

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="text-sm mt-2" style={{ color: "var(--t-mid)" }}>
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing...`
                : `${typingUsers.length} typing...`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}