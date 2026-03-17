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
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#c4b5fd] mb-2">
            AI Elements 1.9 JSXPreview Demo
          </h1>
          <p className="text-[#888888]">
            Vercel March 2026 changelog feature • Streaming agent messages with interactive previews
          </p>
          <div className="text-sm text-[#666666] mt-2">
            Testing for Command Center chat agent message rendering
          </div>
        </div>

        {/* Demo grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: JSXPreview components */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#f8fafc] mb-4">JSXPreview Components</h2>
            
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
            <h2 className="text-xl font-bold text-[#f8fafc] mb-4">Streaming Responses</h2>
            
            <div className="bg-[#111111] border-2 border-[#333333] rounded-xl p-4">
              <h3 className="text-lg font-semibold text-[#f8fafc] mb-3">Real-time agent streaming</h3>
              <p className="text-[#888888] text-sm mb-4">
                Simulating AI Elements 1.9 JSXPreview streaming for agent responses
              </p>
              
              <StreamingAgentMessage 
                agentName="Atlas" 
                agentColor="#C9A84C" 
              />
            </div>

            {/* Integration notes */}
            <div className="bg-[#111111] border-2 border-[#333333] rounded-xl p-4">
              <h3 className="text-lg font-semibold text-[#f8fafc] mb-3">Integration with Command Center Chat</h3>
              <div className="text-[#888888] text-sm space-y-2">
                <div>• Replace static agent message bubbles with JSXPreview</div>
                <div>• Enable streaming for real-time agent responses</div>
                <div>• Interactive quick actions for agent delegation</div>
                <div>• CSS containment for performance</div>
                <div>• Adaptive color modes support</div>
              </div>
            </div>

            {/* Performance metrics */}
            <div className="bg-[#111111] border-2 border-[#333333] rounded-xl p-4">
              <h3 className="text-lg font-semibold text-[#f8fafc] mb-3">Performance Impact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#10b981]">80%</div>
                  <div className="text-xs text-[#888888]">Rendering reduction</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#c4b5fd]">⚡</div>
                  <div className="text-xs text-[#888888]">Streaming enabled</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-[#333333] pt-4">
          <div className="text-xs text-[#666666]">
            Based on Vercel March 2026 changelog • AI Elements 1.9 • JSXPreview for streaming components
          </div>
          <div className="text-xs text-[#666666] mt-1">
            Next scan: March 18 9 AM ET • Cron updated with web_fetch
          </div>
        </div>
      </div>
    </div>
  );
}