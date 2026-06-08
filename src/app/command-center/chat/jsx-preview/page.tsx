"use client";

import AgentMessagePreview, { StreamingAgentMessage } from "@/components/chat/AgentMessagePreview";

export default function JSXPreviewDemoPage() {
  const agents = [
    { name: "Atlas", color: "#C9A84C" },
    { name: "Shuri", color: "#34d399" },
    { name: "Vee", color: "#ec4899" },
    { name: "Proximon", color: "#f97316" }
  ];

  const handleAction = (action: string) => {
    console.log(`Agent action: ${action}`);
    // In real implementation, this would trigger agent workflows
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--ink-1)", color: "var(--t-hi)", fontFamily: "var(--f-display)" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--accent)", fontFamily: "var(--f-tech)", letterSpacing: "0.04em" }}>
            AI Elements 1.9 JSXPreview Demo
          </h1>
          <p style={{ color: "var(--t-mid)" }}>
            Vercel March 2026 changelog feature • Streaming agent messages with interactive previews
          </p>
          <div className="text-sm mt-2" style={{ color: "var(--t-lo)", fontFamily: "var(--f-mono)" }}>
            Testing for Command Center chat agent message rendering
          </div>
        </div>

        {/* Demo grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: JSXPreview components */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--t-hi)", fontFamily: "var(--f-tech)" }}>JSXPreview Components</h2>

            {agents.map((agent) => (
              <div key={agent.name}>
                <AgentMessagePreview
                  agentName={agent.name}
                  agentColor={agent.color}
                  initialContent={`${agent.name} is ready to assist with frontend optimizations.`}
                  onAction={handleAction}
                  streaming={false}
                />
              </div>
            ))}
          </div>

          {/* Column 2: Streaming messages */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold mb-4" style={{ color: "var(--t-hi)", fontFamily: "var(--f-tech)" }}>Streaming Responses</h2>

            <div className="rounded-xl p-4" style={{ background: "var(--ink-2)", border: "1px solid var(--line-2)" }}>
              <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--t-hi)" }}>Real-time agent streaming</h3>
              <p className="text-sm mb-4" style={{ color: "var(--t-mid)" }}>
                Simulating AI Elements 1.9 JSXPreview streaming for agent responses
              </p>

              <StreamingAgentMessage
                agentName="Atlas"
                agentColor="#C9A84C"
              />
            </div>

            {/* Integration notes */}
            <div className="rounded-xl p-4" style={{ background: "var(--ink-2)", border: "1px solid var(--line-2)" }}>
              <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--t-hi)" }}>Integration with Command Center Chat</h3>
              <div className="text-sm space-y-2" style={{ color: "var(--t-mid)" }}>
                <div>• Replace static agent message bubbles with JSXPreview</div>
                <div>• Enable streaming for real-time agent responses</div>
                <div>• Interactive quick actions for agent delegation</div>
                <div>• CSS containment for performance</div>
                <div>• Adaptive color modes support</div>
              </div>
            </div>

            {/* Performance metrics */}
            <div className="rounded-xl p-4" style={{ background: "var(--ink-2)", border: "1px solid var(--line-2)" }}>
              <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--t-hi)" }}>Performance Impact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: "var(--c-green)", fontFamily: "var(--f-mono)" }}>80%</div>
                  <div className="text-xs" style={{ color: "var(--t-mid)" }}>Rendering reduction</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: "var(--accent)" }}>⚡</div>
                  <div className="text-xs" style={{ color: "var(--t-mid)" }}>Streaming enabled</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="text-xs" style={{ color: "var(--t-lo)", fontFamily: "var(--f-mono)" }}>
            Based on Vercel March 2026 changelog • AI Elements 1.9 • JSXPreview for streaming components
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--t-lo)", fontFamily: "var(--f-mono)" }}>
            Next scan: March 18 9 AM ET • Cron updated with web_fetch
          </div>
        </div>
      </div>
    </div>
  );
}
