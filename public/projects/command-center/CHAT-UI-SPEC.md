# Command Center HQ – Chat UI Specification

**Target:** `/Users/admin/ramiche-site/src/app/command-center/chat/`
**Design System:** METTLE-style dark theme (Command Center v4)
**Date:** March 9, 2026

---

## 1. Layout Overview

```
+------------------------------------------------------------------------------+
| [CC LOGO] PARALLAX | DASHBOARD | CHAT | AGENTS | PROJECTS | CALENDAR | SETTINGS |
+------------------------------------------------------------------------------+
| SIDEBAR | CHAT PANEL                                             | THREAD PANEL |
| #general |                                                       | (Slides in)  |
| #mettle  | Message List                                          |              |
| #parallax|                                                       |              |
| #finance | [Input Area]                                          |              |
| #dev     |                                                       |              |
| DM: Atlas|                                                       |              |
| DM: Vee  |                                                       |              |
+------------------------------------------------------------------------------+
```

## 2. Design Tokens (METTLE Dark Theme)

```css
/* Backgrounds */
--bg-main: #0a0a0a;
--bg-sidebar: #111111;
--bg-card: #1a1a1a;
--bg-input: #222222;
--bg-hover: #2a2a2a;

/* Borders & Lines */
--border-base: #333333;
--border-light: #444444;
--border-active: #555555;

/* Text Colors */
--text-primary: #e5e5e5;
--text-secondary: #888888;
--text-tertiary: #666666;
--text-accent: #c4b5fd;  /* Purple accent from PARALLAX */
--text-link: #38bdf8;    /* Cyan for links */

/* Agent Colors */
--color-atlas: #C9A84C;      /* Gold */
--color-shuri: #34d399;      /* Emerald */
--color-vee: #ec4899;        /* Pink */
--color-proximon: #f97316;   /* Orange */
--color-mercury: #fbbf24;    /* Yellow */
--color-widow: #ef4444;      /* Red */

/* Status Indicators */
--status-active: #10b981;    /* Green */
--status-idle: #f59e0b;      /* Amber */
--status-offline: #666666;   /* Gray */

/* Interactive States */
--hover-overlay: rgba(255, 255, 255, 0.05);
--active-overlay: rgba(255, 255, 255, 0.08);
--focus-ring: rgba(124, 58, 237, 0.4);  /* Purple focus */
```

## 3. Component Hierarchy

```
CommandCenterChatPage (page.tsx)
├── MainLayout
│   ├── GlobalNav
│   ├── ThreeColumnLayout
│   │   ├── ChannelSidebar
│   │   │   ├── ChannelList
│   │   │   │   ├── ChannelItem
│   │   │   │   └── ChannelUnreadBadge
│   │   │   ├── DMList
│   │   │   │   ├── DMCard
│   │   │   │   └── AgentStatusIndicator
│   │   │   └── SidebarFooter
│   │   ├── ChatPanel
│   │   │   ├── ChatHeader
│   │   │   ├── MessageList
│   │   │   │   ├── MessageBubble (User)
│   │   │   │   ├── MessageBubble (Agent)
│   │   │   │   ├── MessageTimestamp
│   │   │   │   └── MessageReactions
│   │   │   ├── TypingIndicator
│   │   │   └── MessageInput
│   │   └── ThreadPanel (Conditional)
│   │       ├── ThreadHeader
│   │       ├── ThreadMessages
│   │       └── ThreadReplyInput
│   └── AgentDMPanel (Conditional)
│       ├── AgentHeader
│       ├── AgentChatHistory
│       └── AgentInput
└── GlobalModals
    ├── SettingsPanel
│   │       └── ThreadMessageList
│   └── AgentDMPanel (Conditional)
│       ├── AgentHeader
│       ├── AgentQuickActions
│       └── AgentChatPanel
└── MobileOverlay (Responsive)
```

## 4. Component Specifications

### 4.1 Global Navigation (Top Bar)
```tsx
// Top navigation matching Command Center v4
<div className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-[#333333]">
  <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between">
    {/* Logo & Brand */}
    <Link href="/command-center" className="flex items-center gap-3">
      <div className="w-8 h-10 bg-gradient-to-br from-[#7c3aed] to-[#1a1a5e] rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">CC</span>
      </div>
      <span className="text-[#c4b5fd] font-bold text-lg tracking-[0.2em]">COMMAND</span>
      <span className="text-[#888888] text-sm font-mono">|</span>
      <span className="text-[#888888] text-xs font-bold tracking-[0.1em]">CHAT</span>
    </Link>
    
    {/* Navigation Items */}
    <div className="flex items-center gap-6">
      {[
        { label: "DASHBOARD", href: "/command-center" },
        { label: "CHAT", href: "/command-center/chat", active: true },
        { label: "AGENTS", href: "/command-center/agents" },
        { label: "PROJECTS", href: "/command-center/projects" },
        { label: "CALENDAR", href: "/command-center/calendar" },
        { label: "SETTINGS", href: "/command-center/settings" },
      ].map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`text-xs font-bold tracking-[0.1em] uppercase transition-colors ${
            item.active 
              ? "text-[#c4b5fd] border-b-2 border-[#c4b5fd] pb-1" 
              : "text-[#888888] hover:text-[#e5e5e5]"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
    
    {/* User Menu */}
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#1a1a5e] flex items-center justify-center text-white text-sm font-bold">
        R
      </div>
    </div>
  </div>
</div>
```

### 4.2 Channel Sidebar
```tsx
// Left sidebar with channels and DMs
<div className="w-64 bg-[#111111] border-r border-[#333333] flex flex-col h-full">
  {/* Channels Header */}
  <div className="p-4 border-b border-[#333333]">
    <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-[#888888] mb-2">
      CHANNELS
    </h3>
    
    {/* Channel List */}
    <div className="space-y-1">
      {[
        { id: "general", name: "#general", unread: 3 },
        { id: "mettle", name: "#mettle", unread: 12, active: true },
        { id: "parallax", name: "#parallax", unread: 0 },
        { id: "finance", name: "#finance", unread: 0 },
        { id: "dev", name: "#dev", unread: 7 },
        { id: "design", name: "#design", unread: 0 },
      ].map((channel) => (
        <div
          key={channel.id}
          className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all ${
            channel.active
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
        </div>
      ))}
    </div>
  </div>
  
  {/* Direct Messages Header */}
  <div className="p-4 border-b border-[#333333] flex-1">
    <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-[#888888] mb-2">
      DIRECT MESSAGES
    </h3>
    
    {/* DM List */}
    <div className="space-y-1">
      {[
        { name: "Atlas", status: "active", color: "#C9A84C", unread: 0 },
        { name: "Vee", status: "active", color: "#ec4899", unread: 2 },
        { name: "Shuri", status: "idle", color: "#34d399", unread: 0 },
        { name: "Proximon", status: "offline", color: "#f97316", unread: 0 },
        { name: "Mercury", status: "active", color: "#fbbf24", unread: 1 },
      ].map((agent) => (
        <div
          key={agent.name}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors group"
        >
          {/* Status Indicator */}
          <div className="relative">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: agent.color + "40" }}
            >
              {agent.name.charAt(0)}
            </div>
            <div 
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111111]"
              style={{ 
                backgroundColor: 
                  agent.status === "active" ? "#10b981" :
                  agent.status === "idle" ? "#f59e0b" : "#666666"
              }}
            />
          </div>
          
          {/* Agent Info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[#e5e5e5] truncate">
              {agent.name}
            </div>
            <div className="text-xs text-[#666666]">
              {agent.status === "active" ? "Online" :
               agent.status === "idle" ? "Idle" : "Offline"}
            </div>
          </div>
          
          {/* Unread Badge */}
          {agent.unread > 0 && (
            <div className="w-5 h-5 rounded-full bg-[#7c3aed] text-white text-xs flex items-center justify-center">
              {agent.unread}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
  
  {/* Sidebar Footer */}
  <div className="p-4 border-t border-[#333333]">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#1a1a5e] flex items-center justify-center text-white font-bold">
        R
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-[#e5e5e5]">Ramon</div>
        <div className="text-xs text-[#666666]">@ramiche</div>
      </div>
      <button className="p-2 rounded-lg hover:bg-[#2a2a2a] transition-colors">
        <div className="w-1 h-1 rounded-full bg-[#666666] mb-1"></div>
        <div className="w-1 h-1 rounded-full bg-[#666666] mb-1"></div>
        <div className="w-1 h-1 rounded-full bg-[#666666]"></div>
      </button>
    </div>
  </div>
</div>
```

### 4.3 Message Bubble Components

#### User Message Bubble:
```tsx
<div className="flex justify-end mb-4 group">
  <div className="max-w-[70%]">
    <div className="bg-gradient-to-r from-[#7c3aed] to-[#6b21a8] rounded-2xl rounded-br-none p-4 shadow-lg">
      <div className="text-white text-sm leading-relaxed">
        {message.content}
      </div>
    </div>
    
    {/* Message Metadata */}
    <div className="flex items-center justify-end gap-2 mt-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <span className="text-xs text-[#666666] font-mono">
        {formatTime(message.timestamp)}
      </span>
      {message.edited && (
        <span className="text-xs text-[#666666]">(edited)</span>
      )}
      <button className="text-xs text-[#666666] hover:text-[#888888]">
        ⋮
      </button>
    </div>
    
    {/* Reactions */}
    {message.reactions && message.reactions.length > 0 && (
      <div className="flex gap-1 mt-2 justify-end">
        {message.reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            className="px-2 py-1 rounded-lg bg-[#222222] border border-[#333333] text-xs hover:bg-[#2a2a2a] transition-colors flex items-center gap-1"
          >
            <span>{reaction.emoji}</span>
            <span className="text-[#888888]">{reaction.count}</span>
          </button>
        ))}
      </div>
    )}
  </div>
</div>
```

#### Agent Message Bubble:
```tsx
<div className="flex gap-3 mb-4 group">
  {/* Agent Avatar */}
  <div className="flex-shrink-0">
    <div 
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
      style={{ backgroundColor: agent.color + "40" }}
    >
      {agent.name.charAt(0)}
    </div>
  </div>
  
  {/* Message Content */}
  <div className="flex-1 max-w-[70%]">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-sm font-semibold text-[#e5e5e5]">
        {agent.name}
      </span>
      <span className="text-xs text-[#666666] font-mono">
        {formatTime(message.timestamp)}
      </span>
      <span className="text-xs px-2 py-0.5 rounded-full bg-[#222222] text-[#888888]">
        {agent.role}
      </span>
    </div>
    
    <div className="bg-[#1a1a1a] rounded-2xl rounded-bl-none p-4 border border-[#333333] shadow-lg">
      <div className="text-[#e5e5e5] text-sm leading-relaxed">
        {message.content}
      </div>
      
      {/* Agent-specific actions */}
      {agent.name === "Atlas" && message.actions && (
        <div className="mt-3 pt-3 border-t border-[#333333]">
          <div className="text-xs text-[#888888] mb-2">Quick Actions:</div>
          <div className="flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <button
                key={action.label}
                className="px-3 py-1.5 text-xs rounded-lg bg-[#222222] border border-[#333333] hover:bg-[#2a2a2a] transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    
    {/* Message Actions */}
    <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="text-xs text-[#666666] hover:text-[#888888]">
        👍 React
      </button>
      <button className="text-xs text-[#666666] hover:text-[#888888]">
        💬 Reply
      </button>
      <button className="text-xs text-[#666666] hover:text-[#888888]">
        ↪️ Share
      </button>
      <button className="text-xs text-[#666666] hover:text-[#888888]">
        ⋮ More
      </button>
    </div>
  </div>
</div>
```

### 4.4 Message Input with Typing Indicator
```tsx
<div className="border-t border-[#333333] bg-[#0a0a0a]">
  {/* Typing Indicator */}
  {typingUsers.length > 0 && (
    <div className="px-4 py-2 border-b border-[#333333]">
      <div className="flex items-center gap-2">
        <div className="flex">
          {typingUsers.slice(0, 3).map((user) => (
            <div 
              key={user.id}
              className="w-6 h-6 rounded-full -ml-2 first:ml-0 border-2 border-[#0a0a0a]"
              style={{ backgroundColor: user.color }}
            />
          ))}
        </div>
        <div className="text-sm text-[#888888]">
          {typingUsers.length === 1 
            ? `${typingUsers[0].name} is typing...`
            : `${typingUsers.length} people are typing...`}
        </div>
        <div className="flex gap-1 ml-2">
          <div className="w-1 h-1 rounded-full bg-[#666666] animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-1 rounded-full bg-[#666666] animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-1 h-1 rounded-full bg-[#666666] animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )}
  
  {/* Message Input */}
  <div className="p-4">
    <div className="flex gap-3">
      {/* Attachments */}
      <button className="p-3 rounded-lg bg-[#1a1a1a] border border-[#333333] hover:bg-[#222222] transition-colors">
        <svg className="w-5 h-5 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>
      
      {/* Text Input */}
      <div className="flex-1 relative">
        <textarea
          placeholder={`Message ${currentChannel === 'dm' ? currentAgent?.name : currentChannel}`}
          className="w-full bg-[#1a1a1a] border border-[#333333] rounded-xl px-4 py-3 text-[#e5e5e5] text-sm resize-none focus:outline-none focus:border-[#555555] focus:ring-1 focus:ring-[#7c3aed] min-h-[44px] max-h-[200px]"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        
        {/* Input Actions */}
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-[#222222] transition-colors">
            <svg className="w-4 h-4 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={handleSend}
            className="px-4 py-2 bg-gradient-to-r from-[#7c3aed] to-[#6b21a8] text-white text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!message.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
    
    {/* Quick Actions */}
    <div className="flex gap-2 mt-3">
      <button className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#333333] text-[#888888] hover:bg-[#222222] transition-colors">
        @Mention
      </button>
      <button className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#333333] text-[#888888] hover:bg-[#222222] transition-colors">
        #Channel
      </button>
      <button className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#333333] text-[#888888] hover:bg-[#222222] transition-colors">
        :emoji:
      </button>
      <button className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#333333] text-[#888888] hover:bg-[#222222] transition-colors">
        /Command
      </button>
    </div>
  </div>
</div>
```

### 4.5 Thread Panel (Slides in from right)
```tsx
// Conditional panel that slides in when a message is threaded
<div className={`w-96 bg-[#111111] border-l border-[#333333] flex flex-col h-full transition-transform duration-300 ${
  isThreadOpen ? 'translate-x-0' : 'translate-x-full'
}`}>
  {/* Thread Header */}
  <div className="p-4 border-b border-[#333333] flex items-center justify-between">
    <div className="flex items-center gap-3">
      <button 
        onClick={() => setIsThreadOpen(false)}
        className="p-2 rounded-lg hover:bg-[#2a2a2a] transition-colors"
      >
        <svg className="w-5 h-5 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <div>
        <h3 className="text-sm font-semibold text-[#e5e5e5]">Thread</h3>
        <div className="text-xs text-[#666666]">
          {threadMessages.length} {threadMessages.length === 1 ? 'reply' : 'replies'}
        </div>
      </div>
    </div>
    <button className="p-2 rounded-lg hover:bg-[#2a2a2a] transition-colors">
      <svg className="w-5 h-5 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
  
  {/* Original Message */}
  <div className="p-4 border-b border-[#333333]">
    <div className="text-xs text-[#888888] mb-2">Original message</div>
    <div className="bg-[#1a1a1a] rounded-xl p-3 border border-[#333333]">
      <div className="flex items-center gap-2 mb-2">
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: originalMessage.author.color + "40" }}
        >
          {originalMessage.author.name.charAt(0)}
        </div>
        <span className="text-sm font-semibold text-[#e5e5e5]">
          {originalMessage.author.name}
        </span>
        <span className="text-xs text-[#666666]">
          {formatTime(originalMessage.timestamp)}
        </span>
      </div>
      <div className="text-sm text-[#e5e5e5]">
        {originalMessage.content}
      </div>
    </div>
  </div>
  
  {/* Thread Messages */}
  <div className="flex-1 overflow-y-auto">
    <div className="p-4 space-y-4">
      {threadMessages.map((message) => (
        <div key={message.id} className="flex gap-3">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: message.author.color + "40" }}
          >
            {message.author.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-[#e5e5e5]">
                {message.author.name}
              </span>
              <span className="text-xs text-[#666666]">
                {formatTime(message.timestamp)}
              </span>
            </div>
            <div className="text-sm text-[#e5e5e5]">
              {message.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
  
  {/* Thread Input */}
  <div className="p-4 border-t border-[#333333]">
    <div className="flex gap-2">
      <textarea
        placeholder="Reply to thread..."
        className="flex-1 bg-[#1a1a1a] border border-[#333333] rounded-lg px-3 py-2 text-sm text-[#e5e5e5] resize-none focus:outline-none focus:border-[#555555] min-h-[40px]"
        rows={1}
      />
      <button className="px-4 py-2 bg-gradient-to-r from-[#7c3aed] to-[#6b21a8] text-white text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all">
        Reply
      </button>
    </div>
  </div>
</div>
```

### 4.6 Agent DM Panel Design
```tsx
// Special panel for direct messaging with agents
<div className={`w-96 bg-[#111111] border-l border-[#333333] flex flex-col h-full transition-transform duration-300 ${
  isDMPanelOpen ? 'translate-x-0' : 'translate-x-full'
}`}>
  {/* Agent Header */}
  <div className="p-4 border-b border-[#333333] bg-gradient-to-r from-black/50 to-transparent" style={{
    backgroundImage: `linear-gradient(to right, ${agent.color}20, transparent)`
  }}>
    <div className="flex items-center gap-3">
      <div className="relative">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: agent.color + "40" }}
        >
          {agent.name.charAt(0)}
        </div>
        <div 
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#111111]"
          style={{ 
            backgroundColor: agent.status === "active" ? "#10b981" :
                            agent.status === "idle" ? "#f59e0b" : "#666666"
          }}
        />
      </div>
      
      <div className="flex-1">
        <h3 className="text-lg font-bold text-[#e5e5e5]">{agent.name}</h3>
        <div className="text-sm text-[#888888]">{agent.role}</div>
        <div className="text-xs text-[#666666] mt-1">{agent.desc}</div>
      </div>
      
      <button 
        onClick={() => setIsDMPanelOpen(false)}
        className="p-2 rounded-lg hover:bg-[#2a2a2a] transition-colors"
      >
        <svg className="w-5 h-5 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
  
  {/* Agent Quick Actions */}
  <div className="p-4 border-b border-[#333333]">
    <h4 className="text-xs font-bold tracking-[0.1em] uppercase text-[#888888] mb-3">
      QUICK ACTIONS
    </h4>
    <div className="grid grid-cols-2 gap-2">
      <button className="p-3 rounded-lg bg-[#1a1a1a] border border-[#333333] hover:bg-[#2a2a2a] transition-colors">
        <div className="text-sm font-semibold text-[#e5e5e5]">Assign Task</div>
        <div className="text-xs text-[#666666]">Delegate work</div>
      </button>
      <button className="p-3 rounded-lg bg-[#1a1a1a] border border-[#333333] hover:bg-[#2a2a2a] transition-colors">
        <div className="text-sm font-semibold text-[#e5e5e5]">Request Intel</div>
        <div className="text-xs text-[#666666]">Get analysis</div>
      </button>
      <button className="p-3 rounded-lg bg-[#1a1a1a] border border-[#333333] hover:bg-[#2a2a2a] transition-colors">
        <div className="text-sm font-semibold text-[#e5e5e5]">Schedule Sync</div>
        <div className="text-xs text-[#666666]">Plan meeting</div>
      </button>
      <button className="p-3 rounded-lg bg-[#1a1a1a] border border-[#333333] hover:bg-[#2a2a2a] transition-colors">
        <div className="text-sm font-semibold text-[#e5e5e5]">Review Work</div>
        <div className="text-xs text-[#666666]">Check progress</div>
      </button>
    </div>
  </div>
  
  {/* Agent Context */}
  <div className="p-4 border-b border-[#333333]">
    <h4 className="text-xs font-bold tracking-[0.1em] uppercase text-[#888888] mb-3">
      AGENT CONTEXT
    </h4>
    <div className="space-y-3">
      <div>
        <div className="text-xs text-[#666666]">Current Task</div>
        <div className="text-sm text-[#e5e5e5] mt-1">{agent.activeTask}</div>
      </div>
      <div>
        <div className="text-xs text-[#666666]">Model</div>
        <div className="text-sm text-[#e5e5e5] mt-1">{agent.model}</div>
      </div>
      <div>
        <div className="text-xs text-[#666666]">Credits Used</div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-2 rounded-full bg-[#222222] overflow-hidden">
            <div 
              className="h-full rounded-full"
              style={{ 
                width: `${(agent.credits.used / agent.credits.limit) * 100}%`,
                backgroundColor: agent.color
              }}
            />
          </div>
          <span className="text-xs text-[#888888]">
            {agent.credits.used}/{agent.credits.limit}
          </span>
        </div>
      </div>
    </div>
  </div>
  
  {/* DM Chat Area */}
  <div className="flex-1 flex flex-col">
    <div className="flex-1 overflow-y-auto p-4">
      {/* DM-specific message list */}
      <div className="space-y-4">
        {dmMessages.map((message) => (
          <div key={message.id} className={`flex gap-3 ${
            message.sender === 'user' ? 'justify-end' : ''
          }`}>
            {message.sender !== 'user' && (
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: agent.color + "40" }}
              >
                {agent.name.charAt(0)}
              </div>
            )}
            
            <div className={`max-w-[70%] ${
              message.sender === 'user' 
                ? 'bg-gradient-to-r from-[#7c3aed] to-[#6b21a8] rounded-2xl rounded-br-none p-3'
                : 'bg-[#1a1a1a] border border-[#333333] rounded-2xl rounded-bl-none p-3'
            }`}>
              <div className={`text-sm ${
                message.sender === 'user' ? 'text-white' : 'text-[#e5e5e5]'
              }`}>
                {message.content}
              </div>
              <div className={`text-xs mt-1 ${
                message.sender === 'user' ? 'text-white/60' : 'text-[#666666]'
              }`}>
                {formatTime(message.timestamp)}
              </div>
            </div>
            
            {message.sender === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#1a1a5e] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                R
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
    
    {/* DM Input */}
    <div className="p-4 border-t border-[#333333]">
      <div className="flex gap-2">
        <textarea
          placeholder={`Message ${agent.name}...`}
          className="flex-1 bg-[#1a1a1a] border border-[#333333] rounded-lg px-3 py-2 text-sm text-[#e5e5e5] resize-none focus:outline-none focus:border-[#555555] min-h-[40px]"
          rows={1}
        />
        <button className="px-4 py-2 bg-gradient-to-r from-[#7c3aed] to-[#6b21a8] text-white text-sm font-semibold rounded-lg hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all">
          Send
        </button>
      </div>
    </div>
  </div>
</div>
```

## 5. Responsive Design Considerations

### Mobile (≤ 768px)
```css
/* Hide thread/DM panels as overlays */
@media (max-width: 768px) {
  .thread-panel, .dm-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    z-index: 100;
  }
  
  /* Collapse sidebar into hamburger menu */
  .channel-sidebar {
    position: fixed;
    left: -100%;
    transition: left 0.3s;
  }
  
  .channel-sidebar.open {
    left: 0;
  }
}
```

### Tablet (769px - 1024px)
```css
@media (min-width: 769px) and (max-width: 1024px) {
  .channel-sidebar {
    width: 200px;
  }
  
  .thread-panel, .dm-panel {
    width: 320px;
  }
}
```

## 6. Animation & Micro-interactions

### Message Send Animation
```css
@keyframes message-send {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.message-enter {
  animation: message-send 0.3s ease-out;
}
```

### Typing Indicator Animation
```css
@keyframes typing-pulse {
  0%, 100% {
    opacity: 0.4;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.typing-dot {
  animation: typing-pulse 1.4s infinite;
}
```

## 7. Implementation Notes

1. **State Management**: Use React Context or Zustand for global chat state
2. **Real-time Updates**: Implement WebSocket connections for live messaging
3. **Message Persistence**: Store messages in Firestore with optimistic updates
4. **Image Uploads**: Use Firebase Storage with preview and progress indicators
5. **Search Functionality**: Implement real-time message search with highlighting
6. **Keyboard Shortcuts**: 
   - `Cmd/Ctrl + K` → Quick channel switcher
   - `Cmd/Ctrl + /` → Focus message input
   - `Esc` → Close panels
7. **Accessibility**:
   - ARIA labels for all interactive elements
   - Keyboard navigation support
   - Screen reader announcements for new messages

## 8. File Structure

```
src/app/command-center/chat/
├── page.tsx                    # Main chat page
├── components/
│   ├── ChannelSidebar.tsx      # Channel & DM sidebar
│   ├── MessageList.tsx         # Scrollable message container
│   ├── MessageBubble.tsx       # Individual message component
│   ├── MessageInput.tsx        # Input with attachments
│   ├── ThreadPanel.tsx         # Thread view component
│   ├── AgentDMPanel.tsx        # Agent DM interface
│   └── TypingIndicator.tsx     # Typing animation component
├── hooks/
│   ├── useChat.ts              # Chat state management
│   ├── useWebSocket.ts         # Real-time connection
│   └── useMessageActions.ts    # Message CRUD operations
├── types/
│   └── chat.ts                 # TypeScript interfaces
└── utils/
    ├── formatTime.ts           # Timestamp formatting
    ├── emojiPicker.ts          # Emoji selector
    └── messageParser.ts        # Markdown/link parsing
```

---

**Next Steps:**
1. Create the directory structure
2. Implement base page layout with three-column design
3. Build ChannelSidebar component
4. Implement MessageList with virtual scrolling
5. Add MessageInput with attachment support
6. Implement ThreadPanel and AgentDMPanel
7. Add real-time WebSocket integration
8. Test responsive behavior

This spec provides a complete blueprint for building a METTLE-style chat interface that matches the Command Center v4 design language while maintaining consistency with existing patterns.