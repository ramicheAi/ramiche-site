"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   TERMINAL — Remote Command Interface
   Send commands to Atlas / your Mac from anywhere
   ══════════════════════════════════════════════════════════════════════════════ */

interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  text: string;
  timestamp: string;
}

export default function TerminalPage() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<TerminalLine[]>([
    { type: "system", text: "PARALLAX TERMINAL v1.0 — Remote Shell", timestamp: new Date().toLocaleTimeString() },
    { type: "system", text: "Type a command and press Enter. Commands are sent to Atlas.", timestamp: new Date().toLocaleTimeString() },
    { type: "system", text: "Type 'help' for available commands.", timestamp: new Date().toLocaleTimeString() },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [history]);

  const handleCommand = async (cmd: string) => {
    if (!cmd.trim()) return;
    const ts = new Date().toLocaleTimeString();
    setHistory(prev => [...prev, { type: "input", text: cmd, timestamp: ts }]);
    setInput("");
    setIsProcessing(true);

    // Built-in commands
    const lower = cmd.trim().toLowerCase();
    if (lower === "help") {
      setHistory(prev => [...prev,
        { type: "output", text: "Available commands:", timestamp: ts },
        { type: "output", text: "  status    — Show agent status summary", timestamp: ts },
        { type: "output", text: "  agents    — List all agents and their current state", timestamp: ts },
        { type: "output", text: "  deploy    — Show deployment info", timestamp: ts },
        { type: "output", text: "  clear     — Clear terminal", timestamp: ts },
        { type: "output", text: "  help      — Show this help", timestamp: ts },
        { type: "system", text: "Remote shell commands coming soon (requires OpenClaw node connection).", timestamp: ts },
      ]);
      setIsProcessing(false);
      return;
    }

    if (lower === "clear") {
      setHistory([{ type: "system", text: "Terminal cleared.", timestamp: ts }]);
      setIsProcessing(false);
      return;
    }

    if (lower === "status") {
      setHistory(prev => [...prev,
        { type: "output", text: "╔══════════════════════════════════════╗", timestamp: ts },
        { type: "output", text: "║  PARALLAX OPERATIONS STATUS         ║", timestamp: ts },
        { type: "output", text: "╠══════════════════════════════════════╣", timestamp: ts },
        { type: "output", text: "║  Atlas .............. ACTIVE (Opus)  ║", timestamp: ts },
        { type: "output", text: "║  Agents ............. 19 total       ║", timestamp: ts },
        { type: "output", text: "║  Local Model ........ Qwen 3.5      ║", timestamp: ts },
        { type: "output", text: "║  Sites .............. 2 deployed     ║", timestamp: ts },
        { type: "output", text: "║  METTLE ............. Beta-ready     ║", timestamp: ts },
        { type: "output", text: "╚══════════════════════════════════════╝", timestamp: ts },
      ]);
      setIsProcessing(false);
      return;
    }

    if (lower === "agents") {
      const agents = [
        "Atlas        Opus 4.6       ACTIVE   Operations Lead",
        "TheMAESTRO   Qwen 3.5       IDLE     Music Production",
        "SIMONS       Qwen 3.5       DONE     Algorithmic Analysis",
        "Dr. Strange  Qwen 3.5       IDLE     Forecasting",
        "SHURI        Qwen 3.5       DONE     Creative Coding",
        "Widow        Haiku          IDLE     Security & Intel",
        "PROXIMON     Gemini 3 Pro   IDLE     Architecture",
        "Vee          Qwen 3.5       IDLE     Content & Brand",
        "Aetherion    Gemini 3 Pro   IDLE     Sales & Deals",
        "MICHAEL      GLM 4.6        IDLE     Swim Coaching",
        "Prophets     Qwen 3.5       IDLE     A&R / Talent",
        "SELAH        Qwen 3.5       IDLE     Spiritual Guide",
        "MERCURY      Gemini 3 Pro   IDLE     Marketplace",
        "ECHO         Qwen 3.5       IDLE     Social Listening",
        "HAVEN        Qwen 3.5       IDLE     Home Automation",
        "INK          Qwen 3.5       IDLE     Legal / Contracts",
        "NOVA         Sonnet 4.5     IDLE     Full-Stack Dev",
        "TRIAGE       Sonnet 4.5     IDLE     Diagnostics",
        "KIYOSAKI     Qwen 3.5       IDLE     Finance",
      ];
      setHistory(prev => [
        ...prev,
        { type: "output", text: "NAME         MODEL          STATUS   ROLE", timestamp: ts },
        { type: "output", text: "─".repeat(56), timestamp: ts },
        ...agents.map(a => ({ type: "output" as const, text: a, timestamp: ts })),
      ]);
      setIsProcessing(false);
      return;
    }

    if (lower === "deploy") {
      setHistory(prev => [...prev,
        { type: "output", text: "Deployments:", timestamp: ts },
        { type: "output", text: "  Parallax Site .... ramiche-site.vercel.app", timestamp: ts },
        { type: "output", text: "  Publish .......... parallax-publish.vercel.app", timestamp: ts },
        { type: "output", text: "  METTLE ........... ramiche-site.vercel.app/apex-athlete", timestamp: ts },
        { type: "output", text: "  Command Center ... ramiche-site.vercel.app/command-center", timestamp: ts },
      ]);
      setIsProcessing(false);
      return;
    }

    // Unknown command
    setHistory(prev => [...prev,
      { type: "error", text: `Command not found: ${cmd}`, timestamp: ts },
      { type: "system", text: "Type 'help' for available commands.", timestamp: ts },
    ]);
    setIsProcessing(false);
  };

  const lineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "input": return "#22d3ee";
      case "output": return "#e2e8f0";
      case "error": return "#ef4444";
      case "system": return "#a78bfa";
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "2px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: "12px" }}>
        <Link href="/command-center" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px" }}>← BACK</Link>
        <span style={{ color: "#0f172a", background: "#e2e8f0", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 800 }}>&gt;_</span>
        <span style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.05em" }}>TERMINAL</span>
      </div>

      {/* Terminal Output */}
      <div
        ref={termRef}
        style={{
          padding: "16px 20px",
          height: "calc(100vh - 120px)",
          overflowY: "auto",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
      >
        {history.map((line, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "2px" }}>
            <span style={{ color: "#475569", fontSize: "11px", minWidth: "70px", flexShrink: 0 }}>{line.timestamp}</span>
            {line.type === "input" && <span style={{ color: "#22d3ee" }}>❯ </span>}
            <span style={{ color: lineColor(line.type), whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{line.text}</span>
          </div>
        ))}
        {isProcessing && (
          <div style={{ color: "#a78bfa", animation: "pulse 1s infinite" }}>Processing...</div>
        )}
      </div>

      {/* Input */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "12px 20px",
        borderTop: "2px solid rgba(255,255,255,0.1)",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}>
        <span style={{ color: "#22d3ee", fontWeight: 800 }}>❯</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCommand(input); }}
          placeholder="Type a command..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#e2e8f0",
            fontSize: "14px",
            fontFamily: "inherit",
          }}
          autoFocus
          disabled={isProcessing}
        />
      </div>
    </div>
  );
}
