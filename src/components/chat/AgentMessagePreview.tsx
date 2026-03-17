"use client";

import { useState } from "react";

/**
 * AI Elements 1.9 JSXPreview-inspired component
 * For streaming agent messages with interactive preview
 * Vercel March 2026 changelog feature
 */
interface AgentMessagePreviewProps {
  agentName: string;
  agentColor: string;
  initialContent?: string;
  onAction?: (action: string) => void;
  streaming?: boolean;
}

export default function AgentMessagePreview({
  agentName,
  agentColor,
  initialContent = "",
  onAction,
  streaming = false
}: AgentMessagePreviewProps) {
  const [content, setContent] = useState(initialContent);
  const [isStreaming, setIsStreaming] = useState(streaming);
  const [actions, setActions] = useState<string[]>([
    "Implement",
    "Review",
    "Schedule",
    "Delegate"
  ]);

  // Simulate streaming content (like AI Elements JSXPreview)
  const simulateStream = () => {
    setIsStreaming(true);
    const fullMessage = `I'll implement the dashboard component with content-visibility optimization. The bento grid layout will have 12 columns with adaptive color modes.`;
    
    let current = "";
    const words = fullMessage.split(" ");
    
    const streamInterval = setInterval(() => {
      if (words.length > 0) {
        current += words.shift() + " ";
        setContent(current);
      } else {
        clearInterval(streamInterval);
        setIsStreaming(false);
      }
    }, 100);
  };

  return (
    <div className="bg-[#1a1a1a] border-2 border-[#333333] rounded-2xl rounded-bl-none p-4 shadow-lg">
      {/* Agent header with streaming indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: `${agentColor}40` }}
        >
          {agentName.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-[#e5e5e5]">
            {agentName}
          </div>
          <div className="text-xs text-[#888888]">
            Agent • {isStreaming ? "Streaming..." : "Ready"}
          </div>
        </div>
        {isStreaming && (
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>

      {/* Message content with streaming effect */}
      <div className="text-[#e5e5e5] text-sm leading-relaxed mb-4">
        {content}
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-[#c4b5fd] animate-pulse" />
        )}
      </div>

      {/* Quick actions (JSXPreview-style) */}
      <div className="border-t border-[#333333] pt-3">
        <div className="text-xs text-[#888888] mb-2">Quick Actions:</div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action}
              onClick={() => {
                onAction?.(action);
                simulateStream();
              }}
              className="px-3 py-1.5 text-xs rounded-lg bg-[#222222] border border-[#333333] hover:bg-[#2a2a2a] transition-colors active:scale-95"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* JSXPreview metadata */}
      <div className="text-xs text-[#666666] mt-3 flex items-center gap-2">
        <span>⚡ AI Elements 1.9 JSXPreview</span>
        <span>•</span>
        <span>Streaming enabled</span>
        <span>•</span>
        <button 
          onClick={simulateStream}
          className="text-[#c4b5fd] hover:text-[#a855f7]"
        >
          Test stream
        </button>
      </div>
    </div>
  );
}

/**
 * Streaming message component for real-time agent responses
 */
export function StreamingAgentMessage({ agentName, agentColor }: { agentName: string; agentColor: string }) {
  const [streamedContent] = useState<string[]>([
    "Analyzing dashboard performance...",
    "Found content-visibility optimization opportunity.",
    "Implementing bento grid layout.",
    "Adding adaptive color modes.",
    "Component ready for integration."
  ]);

  return (
    <div className="bg-[#1a1a1a] border-2 border-[#333333] rounded-2xl rounded-bl-none p-4">
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: `${agentColor}40` }}
        >
          {agentName.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-bold text-[#e5e5e5">{agentName}</div>
          <div className="text-xs text-[#888888]">Streaming response</div>
        </div>
        <div className="flex gap-1 ml-auto">
          <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>

      <div className="space-y-2">
        {streamedContent.map((line, index) => (
          <div 
            key={index}
            className="text-sm text-[#e5e5e5] opacity-0 animate-fade-in"
            style={{ 
              animationDelay: `${index * 300}ms`,
              animationFillMode: 'forwards'
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}