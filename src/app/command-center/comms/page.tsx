"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   COMMS — Agent Communication Hub
   Bidirectional message bus for RAMICHE OS agents
   ══════════════════════════════════════════════════════════════════════════════ */

interface BusMessage {
  id: string;
  from: string;
  to: string;
  type: "command" | "query" | "response" | "broadcast";
  payload: string;
  metadata?: Record<string, string>;
  timestamp: number;
}

interface AgentEntry {
  id: string;
  name: string;
  model: string;
  role: string;
  status: string;
  capabilities: string[];
  skills: string[];
  escalation_level?: string;
}

const AGENT_COLORS: Record<string, string> = {
  atlas: "#C9A84C",
  simons: "#22d3ee",
  shuri: "#34d399",
  proximon: "#f97316",
  vee: "#ec4899",
  nova: "#14b8a6",
  triage: "#f472b6",
  widow: "#ef4444",
  kiyosaki: "#fcd34d",
  michael: "#06b6d4",
  selah: "#10b981",
  prophets: "#d4a574",
  themaestro: "#f59e0b",
  echo: "#38bdf8",
  ink: "#c084fc",
  mercury: "#fbbf24",
  haven: "#4ade80",
  themis: "#8b5cf6",
  aetherion: "#818cf8",
  archivist: "#9CA3AF",
  "dr-strange": "#a855f7",
};

const QUICK_COMMANDS = [
  { label: "Status Report", payload: "Provide a full status report of all active agents and current operations." },
  { label: "Run Diagnostics", payload: "Run system diagnostics: check health of all agents, gateway, and infrastructure." },
  { label: "Generate Summary", payload: "Generate an executive summary of today's activity across all agents." },
  { label: "Check Health", payload: "Perform a health check on the RAMICHE OS ecosystem and report any issues." },
];

function agentColor(id: string): string {
  return AGENT_COLORS[id] ?? "#737373";
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return isToday ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function typeBadgeColor(type: BusMessage["type"]): string {
  switch (type) {
    case "command":  return "#f97316";
    case "query":    return "#22d3ee";
    case "response": return "#22c55e";
    case "broadcast": return "#C9A84C";
  }
}

export default function CommsPage() {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [messages, setMessages] = useState<BusMessage[]>([]);
  const [targetAgent, setTargetAgent] = useState("atlas");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.agents?.length > 0) setAgents(data.agents);
      }
    } catch { /* retry next cycle */ }
  }, []);

  const pollMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/command-center/ws?recipient=ramon&since=${lastTimestamp}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.messages?.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const fresh = (data.messages as BusMessage[]).filter((m) => !existingIds.has(m.id));
            if (fresh.length === 0) return prev;
            return [...prev, ...fresh];
          });
          const newest = Math.max(...(data.messages as BusMessage[]).map((m) => m.timestamp));
          setLastTimestamp((prev) => Math.max(prev, newest));
        }
      }
    } catch { /* retry next cycle */ }
  }, [lastTimestamp]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    pollMessages();
    const interval = setInterval(pollMessages, 2000);
    return () => clearInterval(interval);
  }, [pollMessages]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (payload: string, to: string, type: BusMessage["type"] = "command") => {
      setSending(true);
      try {
        const res = await fetch("/api/command-center/ws", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ramon",
            to: type === "broadcast" ? "*" : to,
            type,
            payload,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              if (existingIds.has(data.message.id)) return prev;
              return [...prev, data.message as BusMessage];
            });
            setLastTimestamp((prev) => Math.max(prev, (data.message as BusMessage).timestamp));
          }
          setInputText("");
        }
      } catch { /* show error toast in future */ }
      finally { setSending(false); }
    },
    [],
  );

  const handleSend = () => {
    if (!inputText.trim() || sending) return;
    sendMessage(inputText.trim(), targetAgent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sectionStyle: React.CSSProperties = {
    background: "rgba(0,0,0,0.95)",
    border: "2px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#C9A84C",
    margin: "0 0 14px",
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />

      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 800px 600px at 25% 15%, rgba(201,168,76,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 75% 85%, rgba(129,140,248,0.06) 0%, transparent 60%)",
      }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "32px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link
            href="/command-center"
            style={{
              fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "#737373", textDecoration: "none",
              display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{
                fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5",
                textShadow: "0 0 40px rgba(201,168,76,0.3)",
              }}>
                Agent Comms
              </h1>
              <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>
                {agents.length} agents registered
                <span style={{ marginLeft: 8, color: "rgba(34,197,94,0.6)" }}>
                  ● {agents.filter((a) => a.status === "active").length} active
                </span>
                <span style={{ marginLeft: 8, fontSize: 10, color: "#525252" }}>
                  {messages.length} messages
                </span>
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* ── Left Column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Command Input */}
            <div style={sectionStyle}>
              <p style={labelStyle}>Send Command</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <select
                  value={targetAgent}
                  onChange={(e) => setTargetAgent(e.target.value)}
                  style={{
                    padding: "10px 12px", borderRadius: 8, fontSize: 12,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
                    color: agentColor(targetAgent), fontFamily: "monospace",
                    cursor: "pointer", outline: "none", minWidth: 140,
                  }}
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id} style={{ background: "#111", color: agentColor(a.id) }}>
                      {a.name} — {a.role}
                    </option>
                  ))}
                </select>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", alignSelf: "center",
                  backgroundColor: agentColor(targetAgent),
                  boxShadow: `0 0 10px ${agentColor(targetAgent)}60`,
                }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a command or message..."
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: 10, fontSize: 13,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e5e5e5", outline: "none", fontFamily: "inherit",
                    transition: "border-color 0.2s",
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || sending}
                  style={{
                    padding: "12px 24px", borderRadius: 10, fontSize: 11,
                    fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
                    background: inputText.trim() && !sending ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
                    border: inputText.trim() && !sending ? "2px solid rgba(201,168,76,0.4)" : "2px solid rgba(255,255,255,0.06)",
                    color: inputText.trim() && !sending ? "#C9A84C" : "#525252",
                    transition: "all 0.2s",
                    opacity: sending ? 0.5 : 1,
                  }}
                >
                  {sending ? "SENDING..." : "SEND"}
                </button>
              </div>
            </div>

            {/* Quick Commands */}
            <div style={sectionStyle}>
              <p style={labelStyle}>Quick Commands</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => sendMessage(cmd.payload, "atlas")}
                    disabled={sending}
                    style={{
                      padding: "12px 14px", borderRadius: 10, fontSize: 11,
                      fontWeight: 600, textAlign: "left", cursor: "pointer",
                      background: "rgba(201,168,76,0.06)",
                      border: "1px solid rgba(201,168,76,0.15)",
                      color: "#C9A84C", transition: "all 0.2s",
                    }}
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Broadcast Panel */}
            <div style={{
              ...sectionStyle,
              borderColor: "rgba(201,168,76,0.15)",
              boxShadow: "0 0 24px rgba(201,168,76,0.06), 0 8px 32px rgba(0,0,0,0.4)",
            }}>
              <p style={labelStyle}>Broadcast</p>
              <p style={{ fontSize: 12, color: "#525252", margin: "0 0 12px" }}>
                Send a message to all agents simultaneously.
              </p>
              <button
                onClick={() => {
                  const msg = inputText.trim();
                  if (msg) {
                    sendMessage(msg, "*", "broadcast");
                  }
                }}
                disabled={!inputText.trim() || sending}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10, fontSize: 11,
                  fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
                  background: inputText.trim() ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.03)",
                  border: inputText.trim() ? "2px solid rgba(201,168,76,0.3)" : "2px solid rgba(255,255,255,0.06)",
                  color: inputText.trim() ? "#C9A84C" : "#525252",
                  transition: "all 0.2s",
                }}
              >
                BROADCAST TO ALL AGENTS
              </button>
            </div>
          </div>

          {/* ── Right Column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Message Feed */}
            <div style={{ ...sectionStyle, flex: 1, display: "flex", flexDirection: "column", minHeight: 400 }}>
              <p style={labelStyle}>Message Feed</p>
              <div
                ref={feedRef}
                style={{
                  flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10,
                  paddingRight: 4, maxHeight: 480,
                }}
              >
                {messages.length === 0 ? (
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ fontSize: 28, opacity: 0.15 }}>&#x25CE;</div>
                    <p style={{ fontSize: 12, color: "#525252" }}>No messages yet</p>
                    <p style={{ fontSize: 10, color: "#3f3f3f" }}>Send a command to start the conversation.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwnMessage = msg.from === "ramon";
                    const color = agentColor(isOwnMessage ? msg.to : msg.from);
                    return (
                      <div
                        key={msg.id}
                        style={{
                          padding: "12px 16px", borderRadius: 12,
                          background: isOwnMessage
                            ? "rgba(201,168,76,0.08)"
                            : "rgba(255,255,255,0.03)",
                          border: `1px solid ${isOwnMessage ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.06)"}`,
                          alignSelf: isOwnMessage ? "flex-end" : "flex-start",
                          maxWidth: "85%",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <div style={{
                            width: 8, height: 8, borderRadius: "50%",
                            backgroundColor: color,
                            boxShadow: `0 0 8px ${color}50`,
                          }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color }}>
                            {isOwnMessage ? "You" : msg.from.toUpperCase()}
                          </span>
                          <span style={{
                            fontSize: 8, padding: "2px 6px", borderRadius: 4,
                            background: `${typeBadgeColor(msg.type)}15`,
                            border: `1px solid ${typeBadgeColor(msg.type)}30`,
                            color: typeBadgeColor(msg.type),
                            fontWeight: 700, letterSpacing: "0.1em",
                            textTransform: "uppercase",
                          }}>
                            {msg.type}
                          </span>
                          {msg.to === "*" && (
                            <span style={{
                              fontSize: 8, padding: "2px 6px", borderRadius: 4,
                              background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)",
                              color: "#C9A84C", fontWeight: 700,
                            }}>
                              ALL
                            </span>
                          )}
                          <span style={{ fontSize: 9, color: "#525252", marginLeft: "auto" }}>
                            {formatTimestamp(msg.timestamp)}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: "#d4d4d4", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>
                          {msg.payload}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Agent Status Grid */}
            <div style={sectionStyle}>
              <p style={labelStyle}>Agent Status</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                {agents.map((agent) => {
                  const color = agentColor(agent.id);
                  const isActive = agent.status === "active";
                  const isSelected = targetAgent === agent.id;
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setTargetAgent(agent.id)}
                      style={{
                        padding: "10px 12px", borderRadius: 10, textAlign: "left",
                        cursor: "pointer", transition: "all 0.2s",
                        background: isSelected ? `${color}12` : "rgba(255,255,255,0.02)",
                        border: isSelected
                          ? `2px solid ${color}50`
                          : "2px solid rgba(255,255,255,0.06)",
                        outline: "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: "50%",
                          backgroundColor: isActive ? "#22c55e" : "#525252",
                          boxShadow: isActive ? "0 0 8px rgba(34,197,94,0.5)" : "none",
                        }} />
                        <span style={{
                          fontSize: 11, fontWeight: 700, color,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {agent.name}
                        </span>
                      </div>
                      <span style={{ fontSize: 9, color: "#525252" }}>{agent.role}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        input:focus { border-color: rgba(201,168,76,0.4) !important; }
        select:focus { border-color: rgba(201,168,76,0.4) !important; }
        button:hover:not(:disabled) { filter: brightness(1.15); }
        div::-webkit-scrollbar { width: 4px; }
        div::-webkit-scrollbar-track { background: transparent; }
        div::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>
    </div>
  );
}
