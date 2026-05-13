/**
 * Deterministic Atlas-style briefing composer.
 *
 * Pulls live numbers from the existing CC endpoints and renders a short, naturally
 * spoken status sweep — no LLM call required so the briefing is reliable, free,
 * and works offline-of-OpenClaw.
 */

export interface BriefingAgentInput {
  active: number;
  total: number;
  idle?: string[];
}

export interface BriefingRevenueInput {
  mrr: number;
  arr: number;
  last30: number;
}

export interface BriefingEvent {
  time?: string;
  label?: string;
  agent?: string;
}

export interface BriefingInput {
  now?: Date;
  agents: BriefingAgentInput;
  revenue: BriefingRevenueInput;
  events: BriefingEvent[];
}

export interface ComposedBriefing {
  greeting: string;
  spoken: string;
  bullets: string[];
}

function greetingForHour(h: number): string {
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function dayOfWeek(d: Date): string {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][d.getDay()]!;
}

function monthName(d: Date): string {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][d.getMonth()]!;
}

function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (k >= 11 && k <= 13) return `${n}th`;
  if (j === 1) return `${n}st`;
  if (j === 2) return `${n}nd`;
  if (j === 3) return `${n}rd`;
  return `${n}th`;
}

function speakMoney(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "zero dollars";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} million dollars`;
  if (n >= 1000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${k.toLocaleString("en-US")} thousand dollars` : `${k.toFixed(1)} thousand dollars`;
  }
  return `${Math.round(n).toLocaleString("en-US")} dollars`;
}

function speakMoneyTerse(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function ucFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function composeBriefing(input: BriefingInput): ComposedBriefing {
  const now = input.now ?? new Date();
  const greeting = `${greetingForHour(now.getHours())}, Ramon.`;
  const dateLine = `Today is ${dayOfWeek(now)}, ${monthName(now)} ${ordinal(now.getDate())}.`;

  const sentences: string[] = [greeting, dateLine];
  const bullets: string[] = [];

  const { mrr, last30, arr } = input.revenue;
  if (mrr > 0 || last30 > 0) {
    if (mrr > 0) {
      sentences.push(`MRR sits at ${speakMoney(mrr)}.`);
      bullets.push(`MRR ${speakMoneyTerse(mrr)} · ARR ${speakMoneyTerse(arr)}`);
    }
    if (last30 > 0) {
      bullets.push(`Last 30 days · ${speakMoneyTerse(last30)} processed`);
    }
  } else {
    bullets.push("Revenue feed offline or zero — check Stripe key.");
  }

  if (input.agents.total > 0) {
    sentences.push(
      `${input.agents.active} of ${input.agents.total} agents are online.`
    );
    bullets.push(
      `Agents ${input.agents.active}/${input.agents.total} online`
    );
    if (input.agents.idle && input.agents.idle.length > 0 && input.agents.idle.length <= 3) {
      const names = input.agents.idle.map(ucFirst).join(", ");
      sentences.push(`${names} are idle.`);
    }
  } else {
    bullets.push("Agent directory unreachable.");
  }

  const events = (input.events ?? []).filter((e) => (e.label ?? "").length > 0);
  if (events.length === 0) {
    sentences.push("No scheduled events today.");
    bullets.push("Calendar clear.");
  } else if (events.length === 1) {
    const e = events[0]!;
    sentences.push(
      `One scheduled item${e.time ? ` at ${e.time}` : ""}: ${e.label}${e.agent ? ` with ${ucFirst(e.agent)}` : ""}.`
    );
    bullets.push(`${e.time ?? "—"} · ${e.label}${e.agent ? ` · ${ucFirst(e.agent)}` : ""}`);
  } else {
    const top = events.slice(0, 3);
    const pieces = top.map((e) =>
      e.time ? `${e.label} at ${e.time}` : e.label || "unscheduled item"
    );
    sentences.push(`${events.length} items on the docket. Top of mind: ${pieces.join("; ")}.`);
    top.forEach((e) =>
      bullets.push(`${e.time ?? "—"} · ${e.label}${e.agent ? ` · ${ucFirst(e.agent)}` : ""}`)
    );
    if (events.length > 3) bullets.push(`+${events.length - 3} more`);
  }

  sentences.push("Ready when you are.");

  return {
    greeting: `${greeting} ${dateLine}`,
    spoken: sentences.join(" "),
    bullets,
  };
}
