"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import AgentMessagePreview, { StreamingAgentMessage } from "@/components/chat/AgentMessagePreview";
import { BentoGrid, BentoCard, AthleteStatsCard, ProgressCard, MetricCard, ActionCard } from "@/components/athlete/BentoDashboard";
import { ThemeProvider, useTheme, ThemeToggle } from "@/components/theme/ThemeProvider";

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
  const { resolvedTheme } = useTheme();
  const [activeChannel, setActiveChannel] = useState(CHANNELS[1]);
  const [activeAgent, setActiveAgent] = useState<typeof AGENTS[0] | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<{ id: string; type: string; sender: string; senderColor?: string; content: string; timestamp: string }[]>([]);
  const [typingUsers] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    const newMessage = {
      id: `msg-${Date.now()}`,
      type: "user",
      sender: "Ramon",
      content: messageInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessageInput("");
    
    // Simulate agent response
    setTimeout(() => {
      const replyMessage = {
        id: `reply-${Date.now()}`,
        type: "agent",
        sender: activeAgent?.name || "Atlas",
        senderColor: activeAgent?.color || COLORS.agents.atlas,
        content: `Got it. ${activeAgent?.name || "Atlas"} will handle that.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, replyMessage]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#0e0e18] text-[#f8fafc] flex">
      {/* Sidebar */}
      <div className="w-60 bg-[#111111] border-r-2 border-[#333333] flex flex-col">
        <div className="p-4 border-b-2 border-[#333333]">
          <div className="text-[#c4b5fd] font-bold text-lg">COMMAND</div>
          <div className="text-[#94a3b8] text-xs">Modern Chat</div>
        </div>
        
        <div className="p-4">
          <ThemeToggle />
        </div>

        <div className="p-4 border-b-2 border-[#333333]">
          <div className="text-xs font-bold text-[#94a3b8] mb-3">CHANNELS</div>
          {CHANNELS.map(channel => (
            <button
              key={channel.id}
              onClick={() => setActiveChannel(channel)}
              className={`w-full px-3 py-2 rounded-lg text-sm transition-all ${
                activeChannel.id === channel.id 
                  ? "bg-[#2a2a2a] text-[#f8fafc]" 
                  : "hover:bg-[#1a1a1a] text-[#94a3b8] hover:text-[#f8fafc]"
              }`}
            >
              {channel.name}
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className="text-xs font-bold text-[#94a3b8] mb-3">AGENTS</div>
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent)}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                activeAgent?.id === agent.id
                  ? "bg-[#2a2a2a]"
                  : "hover:bg-[#1a1a1a]"
              }`}
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: `${agent.color}40` }}
              >
                {agent.name.charAt(0)}
              </div>
              <div className="text-sm font-semibold text-[#f8fafc]">
                {agent.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Dashboard Header */}
        <div className="p-4 border-b-2 border-[#333333]">
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
                <div className="bg-gradient-to-r from-[#7c3aed] to-[#6b21a8] rounded-2xl rounded-br-none p-4 max-w-[70%]">
                  <div className="text-white text-sm">{message.content}</div>
                  <div className="text-white/60 text-xs mt-1">{message.timestamp}</div>
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
              <StreamingAgentMessage 
                agentName={typingUsers[0]} 
                agentColor={COLORS.agents[typingUsers[0].toLowerCase() as keyof typeof COLORS.agents] || "#888"}
              />
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t-2 border-[#333333] bg-[#111111]">
          <div className="flex gap-3">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={`Message ${activeChannel.name}...`}
              className="flex-1 bg-[#1a1a1a] border-2 border-[#333333] rounded-xl px-4 py-3 text-[#f8fafc] text-sm resize-none focus:outline-none focus:border-[#555555] min-h-[44px]"
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
              disabled={!messageInput.trim()}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                messageInput.trim()
                  ? "bg-gradient-to-r from-[#7c3aed] to-[#6b21a8] text-white hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                  : "bg-[#222222] text-[#666666] cursor-not-allowed"
              }`}
            >
              Send
            </button>
          </div>

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="text-sm text-[#94a3b8] mt-2">
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