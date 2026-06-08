"use client";

import { useState, useRef, useEffect } from "react";

import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

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
      case "input": return "var(--c-green)";
      case "output": return "var(--t-hi)";
      case "error": return "var(--c-red)";
      case "system": return "var(--accent)";
    }
  };

  return (
    <InstrumentPage
      id="terminal"
      title="Terminal"
      section="Workspace"
      icon="command"
      accent="var(--c-green)"
    >
      <Panel title="Remote Shell" icon="command" style={{ fontFamily: "var(--f-mono)" }}>
        {/* Terminal Output */}
        <div
          ref={termRef}
          style={{
            padding: "16px 20px",
            height: "calc(100vh - 320px)",
            minHeight: 280,
            overflowY: "auto",
            fontSize: "13px",
            lineHeight: "1.6",
          }}
        >
          {history.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "2px" }}>
              <span style={{ color: "var(--t-lo)", fontSize: "11px", minWidth: "70px", flexShrink: 0 }}>{line.timestamp}</span>
              {line.type === "input" && <span style={{ color: "var(--c-green)" }}>❯ </span>}
              <span style={{ color: lineColor(line.type), whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{line.text}</span>
            </div>
          ))}
          {isProcessing && (
            <div style={{ color: "var(--accent)", animation: "pulse 1s infinite" }}>Processing...</div>
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--line-2)",
          background: "var(--ink-2)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <span style={{ color: "var(--c-green)", fontWeight: 800 }}>❯</span>
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
              color: "var(--t-hi)",
              fontSize: "14px",
              fontFamily: "var(--f-mono)",
            }}
            autoFocus
            disabled={isProcessing}
          />
        </div>
      </Panel>
    </InstrumentPage>
  );
}
