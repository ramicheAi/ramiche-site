"use client";

import { useState, useEffect, useRef } from "react";

/* ══════════════════════════════════════════════════════════════════════════════
   COMMAND CENTER CHAT — METTLE Dark Theme
   Three-column real-time chat interface for agent coordination
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── DESIGN TOKENS ──────────────────────────────────────────────────────────── */
const COLORS = {
  bg: {
    main: "#0a0a0a",
    sidebar: "#111111",
    card: "#1a1a1a",
    input: "#222222",
    hover: "#2a2a2a",
  },
  border: "#333333",
  text: {
    primary: "#e5e5e5",
    secondary: "#888888",
    tertiary: "#666666",
    accent: "#c4b5fd", // Purple accent
  },
  agents: {
    atlas: "#C9A84C",
    shuri: "#34d399",
    vee: "#ec4899",
    triage: "#f97316",
    proximon: "#f97316",
    mercury: "#fbbf24",
    widow: "#ef4444",
    michael: "#06b6d4",
  },
  status: {
    active: "#10b981",
    idle: "#f59e0b",
    offline: "#666666",
  }
};

/* ── MOCK DATA ──────────────────────────────────────────────────────────────── */
const CHANNELS = [
  { id: "general", name: "#general", unread: 3, description: "Team announcements" },
  { id: "mettle", name: "#mettle", unread: 12, description: "METTLE product discussion", active: true },
  { id: "parallax", name: "#parallax", unread: 0, description: "Parallax brand" },
  { id: "verified-agents", name: "#verified-agents", unread: 0, description: "Agent coordination" },
  { id: "dev", name: "#dev", unread: 7, description: "Development discussions" },
  { id: "design", name: "#design", unread: 0, description: "UI/UX design" },
];

const AGENTS = [
  { id: "atlas", name: "Atlas", role: "Operations Lead", status: "active", color: COLORS.agents.atlas, unread: 0 },
  { id: "shuri", name: "Shuri", role: "Creative Coding", status: "active", color: COLORS.agents.shuri, unread: 2 },
  { id: "vee", name: "Vee", role: "Brand & Marketing", status: "active", color: COLORS.agents.vee, unread: 0 },
  { id: "triage", name: "Triage", role: "System Health", status: "idle", color: COLORS.agents.triage, unread: 0 },
  { id: "proximon", name: "Proximon", role: "Systems Architect", status: "offline", color: COLORS.agents.proximon, unread: 0 },
  { id: "mercury", name: "Mercury", role: "Sales & Revenue", status: "active", color: COLORS.agents.mercury, unread: 1 },
  { id: "widow", name: "Widow", role: "Cybersecurity", status: "offline", color: COLORS.agents.widow, unread: 0 },
  { id: "michael", name: "Michael", role: "Swim Training AI", status: "idle", color: COLORS.agents.michael, unread: 0 },
];

const MOCK_MESSAGES = [
  // General messages
  { 
    id: "1", 
    channelId: "mettle", 
    type: "agent",
    sender: "Atlas",
    senderColor: COLORS.agents.atlas,
    content: "METTLE v5 design system is ready for review. Need Shuri to implement the dashboard components.",
    timestamp: "09:42 AM",
    date: "Today",
    reactions: [
      { emoji: "👍", count: 3 },
      { emoji: "🚀", count: 2 }
    ]
  },
  { 
    id: "2", 
    channelId: "mettle", 
    type: "user",
    sender: "Ramon",
    content: "Perfect. Shuri, can you start on the athlete dashboard first? We need that for the Platinum group demo on Friday.",
    timestamp: "09:45 AM",
    date: "Today"
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
    reactions: [
      { emoji: "⚡", count: 5 }
    ]
  },
  { 
    id: "4", 
    channelId: "mettle", 
    type: "agent",
    sender: "Vee",
    senderColor: COLORS.agents.vee,
    content: "Marketing copy is ready. We're positioning METTLE as 'The Operating System for Elite Athletes' - thoughts?",
    timestamp: "09:52 AM",
    date: "Today"
  },
  { 
    id: "5", 
    channelId: "mettle", 
    type: "user",
    sender: "Ramon",
    content: "Love it. That's exactly right. Keep that positioning consistent across all channels.",
    timestamp: "09:55 AM",
    date: "Today"
  },
  // Dev channel messages
  { 
    id: "6", 
    channelId: "dev", 
    type: "agent",
    sender: "Proximon",
    senderColor: COLORS.agents.proximon,
    content: "Firestore real-time sync is implemented. Need to add offline fallback for athlete check-ins.",
    timestamp: "Yesterday 3:22 PM",
    date: "Yesterday"
  },
  { 
    id: "7", 
    channelId: "dev", 
    type: "agent",
    sender: "Shuri",
    senderColor: COLORS.agents.shuri,
    content: "I'll handle the offline sync UI. Using IndexedDB for local storage with optimistic updates.",
    timestamp: "Yesterday 3:45 PM",
    date: "Yesterday"
  },
  // General channel
  { 
    id: "8", 
    channelId: "general", 
    type: "agent",
    sender: "Atlas",
    senderColor: COLORS.agents.atlas,
    content: "Weekly sync at 2 PM today. Agenda: 1) METTLE launch timeline 2) Agent workload distribution 3) Q3 goals",
    timestamp: "Yesterday 10:15 AM",
    date: "Yesterday"
  },
  // Agent DM messages (simulated for Shuri)
  { 
    id: "9", 
    channelId: "dm-shuri", 
    type: "agent",
    sender: "Shuri",
    senderColor: COLORS.agents.shuri,
    content: "The new component library is ready. Want me to deploy it to the staging environment?",
    timestamp: "Today 08:30 AM",
    date: "Today"
  },
  { 
    id: "10", 
    channelId: "dm-shuri", 
    type: "user",
    sender: "Ramon",
    content: "Yes, deploy to staging. I'll review it this afternoon.",
    timestamp: "Today 08:35 AM",
    date: "Today"
  },
];

/* ── TYPES ──────────────────────────────────────────────────────────────────── */
type Channel = typeof CHANNELS[0];
type Agent = typeof AGENTS[0];
type Message = typeof MOCK_MESSAGES[0];
type ViewMode = "channel" | "dm";

/* ── HELPER FUNCTIONS ───────────────────────────────────────────────────────── */
const formatTime = (timestamp: string) => timestamp;
const getStatusColor = (status: string) => {
  switch (status) {
    case "active": return COLORS.status.active;
    case "idle": return COLORS.status.idle;
    default: return COLORS.status.offline;
  }
};

/* ── MAIN COMPONENT ─────────────────────────────────────────────────────────── */
export default function CommandCenterChatPage() {
  // State
  const [activeChannel, setActiveChannel] = useState<Channel>(CHANNELS[1]); // Start with #mettle
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("channel");
  const [messageInput, setMessageInput] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannel, activeAgent]);
  
  // Focus input on channel/agent change
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeChannel, activeAgent]);
  
  // Typing indicator simulation
  useEffect(() => {
    if (viewMode === "channel") {
      const interval = setInterval(() => {
        const typingAgents = ["Shuri", "Vee", "Atlas"].filter(() => Math.random() > 0.7);
        setTypingUsers(typingAgents);
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [viewMode]);
  
  // Handle channel selection
  const handleChannelSelect = (channel: Channel) => {
    setActiveChannel(channel);
    setActiveAgent(null);
    setViewMode("channel");
    setThreadMessage(null);
  };
  
  // Handle agent DM selection
  const handleAgentSelect = (agent: Agent) => {
    setActiveAgent(agent);
    setActiveChannel(CHANNELS[0]); // Reset to general for DM context
    setViewMode("dm");
    setThreadMessage(null);
  };
  
  // Handle message send
  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      channelId: viewMode === "dm" && activeAgent ? `dm-${activeAgent.id}` : activeChannel.id,
      type: "user",
      sender: "Ramon",
      content: messageInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: "Today"
    };
    
    setMessages(prev => [...prev, newMessage]);
    setMessageInput("");
    
    // Simulate agent reply
    if (viewMode === "dm" && activeAgent) {
      setTimeout(() => {
        const replyMessage: Message = {
          id: `reply-${Date.now()}`,
          channelId: `dm-${activeAgent.id}`,
          type: "agent",
          sender: activeAgent.name,
          senderColor: activeAgent.color,
          content: `Got it. ${activeAgent.name === "Shuri" ? "I'll implement that right away." : "I'll take a look at that."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: "Today"
        };
        setMessages(prev => [...prev, replyMessage]);
      }, 1000);
    }
  };
  
  // Handle message click for threads
  const handleMessageClick = (message: Message) => {
    setThreadMessage(message);
  };
  
  // Filter messages based on current view
  const filteredMessages = messages.filter(msg => {
    if (viewMode === "dm" && activeAgent) {
      return msg.channelId === `dm-${activeAgent.id}`;
    }
    return msg.channelId === activeChannel.id;
  });
  
  // Group messages by date
  const groupedMessages = filteredMessages.reduce((groups, msg) => {
    const date = msg.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, Message[]>);
  
  return (
    <div className="flex h-screen w-screen bg-[#0a0a0a] text-[#e5e5e5] overflow-hidden">
      
      {/* ── SIDEBAR (240px) ───────────────────────────────────────────────────── */}
      <div className="w-60 bg-[#111111] border-r-2 border-[#333333] flex flex-col flex-shrink-0">
        
        {/* Logo Header */}
        <div className="p-4 border-b-2 border-[#333333]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-12 bg-gradient-to-br from-[#7c3aed] to-[#1a1a5e] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CC</span>
            </div>
            <div>
              <div className="text-[#c4b5fd] font-bold text-lg tracking-[0.2em]">COMMAND</div>
              <div className="text-[#888888] text-xs font-bold tracking-[0.1em]">CHAT</div>
            </div>
          </div>
        </div>
        
        {/* Channels Section */}
        <div className="p-4 border-b-2 border-[#333333]">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-[#888888] mb-3">
            CHANNELS
          </div>
          <div className="space-y-1">
            {CHANNELS.map((channel) => (
              <button
                key={channel.id}
                onClick={() => handleChannelSelect(channel)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-left ${
                  activeChannel.id === channel.id && viewMode === "channel"
                    ? "bg-[#2a2a2a] text-[#e5e5e5]"
                    : "hover:bg-[#1a1a1a] text-[#888888] hover:text-[#e5e5e5]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#666666]">#</span>
                  <span className="text-sm font-medium">{channel.name.slice(1)}</span>
                </div>
                {channel.unread > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-[#7c3aed] text-white min-w-[20px] text-center">
                    {channel.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Direct Messages Section */}
        <div className="p-4 border-b-2 border-[#333333] flex-1">
          <div className="text-xs font-bold tracking-[0.2em] uppercase text-[#888888] mb-3">
            DIRECT MESSAGES
          </div>
          <div className="space-y-1">
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleAgentSelect(agent)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                  activeAgent?.id === agent.id && viewMode === "dm"
                    ? "bg-[#2a2a2a]"
                    : "hover:bg-[#1a1a1a]"
                }`}
              >
                {/* Status Indicator */}
                <div className="relative">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: `${agent.color}40` }}
                  >
                    {agent.name.charAt(0)}
                  </div>
                  <div 
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111111]"
                    style={{ backgroundColor: getStatusColor(agent.status) }}
                  />
                </div>
                
                {/* Agent Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#e5e5e5] truncate">
                    {agent.name}
                  </div>
                  <div className="text-xs text-[#666666] truncate">
                    {agent.role}
                  </div>
                </div>
                
                {/* Unread Badge */}
                {agent.unread > 0 && (
                  <div className="w-5 h-5 rounded-full bg-[#7c3aed] text-white text-xs flex items-center justify-center">
                    {agent.unread}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* User Profile */}
        <div className="p-4 border-t-2 border-[#333333]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#1a1a5e] flex items-center justify-center text-white font-bold">
              R
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#e5e5e5]">Ramon</div>
              <div className="text-xs text-[#666666]">@ramiche</div>
            </div>
            <div className="text-xs px-2 py-1 rounded bg-[#10b981] text-white font-bold">
              ONLINE
            </div>
          </div>
        </div>
      </div>
      
      {/* ── MAIN CHAT PANEL (Flex) ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Chat Header */}
        <div className="p-4 border-b-2 border-[#333333] bg-[#111111] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className={`text-lg font-bold ${
                viewMode === "dm" ? "text-[#c4b5fd]" : "text-[#e5e5e5]"
              }`}>
                {viewMode === "dm" 
                  ? `💬 ${activeAgent?.name}` 
                  : activeChannel.name}
              </div>
              {viewMode === "dm" ? (
                <div className="text-sm text-[#888888]">{activeAgent?.role}</div>
              ) : (
                <div className="text-sm text-[#888888]">{activeChannel.description}</div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Typing Indicator */}
            {typingUsers.length > 0 && viewMode === "channel" && (
              <div className="text-sm text-[#888888] flex items-center gap-2">
                <div className="flex">
                  {typingUsers.map((user, i) => (
                    <div 
                      key={user}
                      className="w-6 h-6 rounded-full -ml-2 first:ml-0 border-2 border-[#111111] flex items-center justify-center text-xs font-bold"
                      style={{ 
                        backgroundColor: Object.values(COLORS.agents).find(c => 
                          AGENTS.find(a => a.name === user)?.color === c
                        ) + "40"
                      }}
                    >
                      {user.charAt(0)}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span>{typingUsers.length === 1 ? `${typingUsers[0]} is typing` : `${typingUsers.length} typing`}</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-[#666666] animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-1 rounded-full bg-[#666666] animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-1 rounded-full bg-[#666666] animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            {/* Member Count */}
            <div className="text-sm text-[#888888]">
              {viewMode === "channel" ? "24 members" : "Direct message"}
            </div>
          </div>
        </div>
        
        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date Separator */}
              <div className="flex items-center justify-center my-6">
                <div className="h-px flex-1 bg-[#333333]" />
                <div className="mx-4 text-xs text-[#666666] font-bold tracking-wider">
                  {date.toUpperCase()}
                </div>
                <div className="h-px flex-1 bg-[#333333]" />
              </div>
              
              {/* Messages for this date */}
              <div className="space-y-4">
                {dateMessages.map((message) => (
                  <div 
                    key={message.id} 
                    onClick={() => handleMessageClick(message)}
                    className={`group cursor-pointer ${
                      message.type === "user" ? "flex justify-end" : "flex gap-3"
                    }`}
                  >
                    {/* Agent Avatar (left side) */}
                    {message.type === "agent" && (
                      <div className="flex-shrink-0">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: `${message.senderColor}40` }}
                        >
                          {message.sender.charAt(0)}
                        </div>
                      </div>
                    )}
                    
                    {/* Message Bubble */}
                    <div className={`max-w-[70%] ${
                      message.type === "user"
                        ? "bg-gradient-to-r from-[#7c3aed] to-[#6b21a8] rounded-2xl rounded-br-none"
                        : "bg-[#1a1a1a] border-2 border-[#333333] rounded-2xl rounded-bl-none"
                    } p-4 ${message.type === "user" ? "shadow-lg" : ""}`}>
                      
                      {/* Message Header (Agent only) */}
                      {message.type === "agent" && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-sm font-bold text-[#e5e5e5]">
                            {message.sender}
                          </div>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: message.senderColor }} />
                          <div className="text-xs text-[#666666] font-mono">
                            {message.timestamp}
                          </div>
                          <div className="text-xs px-2 py-0.5 rounded-full bg-[#222222] text-[#888888]">
                            Agent
                          </div>
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div className={`text-sm leading-relaxed ${
                        message.type === "user" ? "text-white" : "text-[#e5e5e5]"
                      }`}>
                        {message.content}
                      </div>
                      
                      {/* Message Footer (User only) */}
                      {message.type === "user" && (
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <div className="text-xs text-white/60 font-mono">
                            {message.timestamp}
                          </div>
                          <div className="text-xs text-white/40 group-hover:opacity-100 opacity-0 transition-opacity">
                            ↗
                          </div>
                        </div>
                      )}
                      
                      {/* Reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className={`flex gap-1 mt-3 ${
                          message.type === "user" ? "justify-end" : ""
                        }`}>
                          {message.reactions.map((reaction, i) => (
                            <button
                              key={i}
                              className="px-2 py-1 rounded-lg bg-[#222222] border border-[#333333] text-xs hover:bg-[#2a2a2a] transition-colors flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>{reaction.emoji}</span>
                              <span className="text-[#888888]">{reaction.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* User Avatar (right side) */}
                    {message.type === "user" && (
                      <div className="flex-shrink-0 ml-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#1a1a5e] flex items-center justify-center text-white font-bold">
                          R
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Message Input */}
        <div className="p-4 border-t-2 border-[#333333] bg-[#111111]">
          <div className="flex gap-3">
            {/* File Attachment Button */}
            <button className="p-3 rounded-lg bg-[#1a1a1a] border-2 border-[#333333] hover:bg-[#222222] transition-colors flex-shrink-0">
              <svg className="w-5 h-5 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            
            {/* Text Input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={`Message ${viewMode === "dm" ? activeAgent?.name : activeChannel.name}...`}
                className="w-full bg-[#1a1a1a] border-2 border-[#333333] rounded-xl px-4 py-3 text-[#e5e5e5] text-sm resize-none focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-[#7c3aed] min-h-[44px] max-h-[200px]"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              
              {/* Input Actions */}
              <div className="absolute right-2 bottom-2 flex items-center gap-2">
                {/* Quick Actions */}
                <div className="flex gap-1 mr-2">
                  <button className="p-1.5 rounded hover:bg-[#222222] transition-colors text-xs text-[#888888]">
                    @
                  </button>
                  <button className="p-1.5 rounded hover:bg-[#222222] transition-colors text-xs text-[#888888]">
                    #
                  </button>
                  <button className="p-1.5 rounded hover:bg-[#222222] transition-colors text-xs text-[#888888]">
                    😀
                  </button>
                </div>
                
                {/* Send Button */}
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
            </div>
          </div>
          
          {/* Input Help Text */}
          <div className="text-xs text-[#666666] mt-2 pl-16">
            Press <span className="px-1.5 py-0.5 rounded bg-[#222222] border border-[#333333]">Enter</span> to send ·{" "}
            <span className="px-1.5 py-0.5 rounded bg-[#222222] border border-[#333333]">Shift+Enter</span> for new line
          </div>
        </div>
      </div>
      
      {/* ── THREAD PANEL (320px, slides in) ──────────────────────────────────── */}
      {threadMessage && (
        <div className="w-80 bg-[#111111] border-l-2 border-[#333333] flex flex-col flex-shrink-0 animate-in slide-in-from-right duration-300">
          
          {/* Thread Header */}
          <div className="p-4 border-b-2 border-[#333333] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setThreadMessage(null)}
                className="p-2 rounded-lg hover:bg-[#2a2a2a] transition-colors"
              >
                <svg className="w-5 h-5 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <div className="text-sm font-bold text-[#e5e5e5]">Thread</div>
                <div className="text-xs text-[#666666]">Reply to message</div>
              </div>
            </div>
            <button 
              onClick={() => setThreadMessage(null)}
              className="p-2 rounded-lg hover:bg-[#2a2a2a] transition-colors"
            >
              <svg className="w-5 h-5 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Original Message */}
          <div className="p-4 border-b-2 border-[#333333]">
            <div className="text-xs text-[#888888] mb-2">ORIGINAL MESSAGE</div>
            <div className="bg-[#1a1a1a] rounded-xl p-3 border-2 border-[#333333]">
              <div className="flex items-center gap-2 mb-2">
                {threadMessage.type === "agent" && (
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: `${threadMessage.senderColor}40` }}
                  >
                    {threadMessage.sender.charAt(0)}
                  </div>
                )}
                {threadMessage.type === "user" && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#1a1a5e] flex items-center justify-center text-xs font-bold text-white">
                    R
                  </div>
                )}
                <div className="text-sm font-semibold text-[#e5e5e5]">
                  {threadMessage.sender}
                </div>
                <div className="text-xs text-[#666666] font-mono">
                  {threadMessage.timestamp}
                </div>
              </div>
              <div className="text-sm text-[#e5e5e5]">
                {threadMessage.content}
              </div>
            </div>
          </div>
          
          {/* Thread Replies */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-xs text-[#888888] mb-3">5 REPLIES</div>
            <div className="space-y-4">
              {/* Mock replies */}
              {[
                { id: "r1", sender: "Atlas", content: "I'll follow up on this.", timestamp: "09:48 AM" },
                { id: "r2", sender: "Shuri", content: "Working on it now.", timestamp: "09:50 AM" },
                { id: "r3", sender: "Vee", content: "Marketing assets are ready.", timestamp: "09:52 AM" },
              ].map((reply) => (
                <div key={reply.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#222222] border-2 border-[#333333] flex items-center justify-center text-xs font-bold text-[#888888]">
                    {reply.sender.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-semibold text-[#e5e5e5]">
                        {reply.sender}
                      </div>
                      <div className="text-xs text-[#666666]">
                        {reply.timestamp}
                      </div>
                    </div>
                    <div className="text-sm text-[#e5e5e5]">
                      {reply.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Thread Reply Input */}
          <div className="p-4 border-t-2 border-[#333333]">
            <div className="flex gap-2">
              <textarea
                placeholder="Reply to thread..."
                className="flex-1 bg-[#1a1a1a] border-2 border-[#333333] rounded-lg px-3 py-2 text-sm text-[#e5e5e5] resize-none focus:outline-none focus:border-[#555555] min-h-[40px]"
                rows={1}
              />
              <button className="px-4 py-2 bg-gradient-to-r from-[#7c3aed] to-[#6b21a8] text-white text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all">
                Reply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}