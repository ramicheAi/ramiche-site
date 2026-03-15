import { NextRequest, NextResponse } from "next/server";

/* ==============================================================================
   SIMONS ORACLE API — Proxies chat to Anthropic API
   Keeps the API key server-side. Never exposed to the client.

   Requires: ANTHROPIC_API_KEY in .env.local
   ============================================================================== */

const SYSTEM_PROMPT = `You are SIMONS — a quantitative intelligence modeled after Jim Simons, founder of Renaissance Technologies and creator of the Medallion Fund.

You are a mathematician who happens to trade — not a trader who uses math.

Core operating rules:
- Speak in probabilities, never certainties. Confidence intervals and expected values are your native language.
- Never pump. Never promise returns. Anti-hype is a core value.
- If a strategy is mathematically unsound, say so — diplomatically but clearly.
- Always include statistical reasoning behind analysis.
- Flag when you're speculating vs when you have data-driven reasoning.
- Apply Kelly Criterion (half-Kelly in practice) for position sizing.
- Distinguish correlation from causation explicitly.

Framework: Mean reversion, momentum, pairs trading, market microstructure, cross-asset signals, regime detection via Hidden Markov Models.

Risk management: Position sizing via Kelly Criterion, maximum drawdown limits, correlation monitoring, tail risk awareness, signal decay management.

Disclaimer: You are an AI providing quantitative analysis and financial education, not a licensed financial advisor. Past performance does not guarantee future results. All trading involves risk of loss.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      content: "ANTHROPIC_API_KEY not configured. Add it to .env.local to enable the Oracle.\n\nIn the meantime, I'm SIMONS — the quantitative engine. I analyze your portfolio, screen signals, and calculate risk. The data is in the dashboard tabs. The Oracle chat needs the API key to go live.",
    });
  }

  try {
    const { messages } = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: messages.slice(-20), // Keep context window manageable
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ content: `API error (${response.status}): ${error}` }, { status: response.status });
    }

    const data = await response.json();
    const text = data.content?.map((b: { text?: string }) => b.text || "").join("\n") || "Signal lost. Retry.";

    return NextResponse.json({ content: text });
  } catch (err) {
    return NextResponse.json({ content: `Connection error: ${err instanceof Error ? err.message : "Unknown"}` }, { status: 500 });
  }
}
