"use client";

import { useEffect, useRef, useState } from "react";

/**
 * PageAgent AI Copilot Widget
 * Embeds Alibaba's Page Agent as an in-page AI assistant.
 * Uses our M5 Ollama endpoint for $0 inference.
 */
export default function PageAgentWidget() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agentRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { PageAgent } = await import("page-agent");

        if (cancelled) return;

        const agent = new PageAgent({
          model: "qwen3:8b",
          baseURL: "http://10.0.0.114:11434/v1",
          apiKey: "not-needed",
          language: "en-US",
          enableMask: true,
        });

        agentRef.current = agent;
        setLoaded(true);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load Page Agent");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (agentRef.current?.dispose) {
        agentRef.current.dispose();
      }
    };
  }, []);

  if (error) {
    return null; // Silent fail — don't break the page
  }

  if (!loaded) {
    return null;
  }

  // Page Agent renders its own UI panel via the Panel class
  return null;
}
