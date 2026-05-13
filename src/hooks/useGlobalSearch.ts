"use client";

import { useEffect, useRef, useState } from "react";

export type GlobalResultKind = "message" | "doc" | "memory";

export interface GlobalSearchResult {
  kind: GlobalResultKind;
  id: string;
  title: string;
  subtitle?: string;
  preview?: string;
  href: string;
  meta?: string;
  accent?: string;
}

export interface GlobalSearchSnapshot {
  query: string;
  loading: boolean;
  results: GlobalSearchResult[];
  unavailable: boolean;
}

interface DocsResponse {
  documents?: Array<{ title: string; category: string; author?: string; summary?: string; date?: string; status?: string }>;
}

interface MemoryResponse {
  days?: Array<{
    date: string;
    day?: string;
    entries?: Array<{ time?: string; title: string; content?: string; agent?: string }>;
  }>;
}

interface MessageHit {
  id: string;
  channelId: string;
  content: string;
  createdAt: string;
  agentId?: string | null;
  senderType?: string | null;
}

interface MessageSearchResponse {
  results?: MessageHit[];
  skipped?: boolean;
}

const DOC_TINT = "#3b82f6";
const MEM_TINT = "#a855f7";
const MSG_TINT = "#7c3aed";

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function ucFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function rankBlob(query: string, blob: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const b = blob.toLowerCase();
  if (b.startsWith(q)) return 4;
  if (b.includes(q)) return 3;
  let i = 0;
  for (const c of q) {
    const next = b.indexOf(c, i);
    if (next === -1) return 0;
    i = next + 1;
  }
  return 1;
}

export function useGlobalSearch(query: string, enabled: boolean): GlobalSearchSnapshot {
  const [snapshot, setSnapshot] = useState<GlobalSearchSnapshot>({
    query: "",
    loading: false,
    results: [],
    unavailable: false,
  });
  const reqRef = useRef(0);

  const docsRef = useRef<DocsResponse["documents"] | null>(null);
  const memoryRef = useRef<MemoryResponse["days"] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const q = query.trim();
    if (q.length < 2) {
      setSnapshot({ query: q, loading: false, results: [], unavailable: false });
      return;
    }

    const id = ++reqRef.current;
    setSnapshot((s) => ({ ...s, loading: true, query: q }));

    const t = window.setTimeout(() => {
      void (async () => {
        const results: GlobalSearchResult[] = [];
        let unavailable = false;

        // Messages — server filtered.
        try {
          const params = new URLSearchParams({ q, limit: "8" });
          const res = await fetch(`/api/command-center/chat/search?${params.toString()}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = (await res.json()) as MessageSearchResponse;
            if (data.skipped) {
              unavailable = true;
            } else {
              for (const m of data.results ?? []) {
                const sender = m.senderType === "user" ? "You" : ucFirst((m.agentId ?? "agent").replace(/-/g, " "));
                results.push({
                  kind: "message",
                  id: `msg:${m.id}`,
                  title: truncate(m.content.replace(/\s+/g, " ").trim(), 80) || "(empty)",
                  subtitle: `${sender} · ${new Date(m.createdAt).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`,
                  href: `/command-center/chat#msg=${m.id}`,
                  meta: "Message",
                  accent: MSG_TINT,
                });
              }
            }
          }
        } catch {
          /* skip messages */
        }

        // Docs — fetch once, filter client-side.
        try {
          if (!docsRef.current) {
            const res = await fetch("/api/command-center/docs", { cache: "no-store" });
            if (res.ok) {
              const data = (await res.json()) as DocsResponse;
              docsRef.current = data.documents ?? [];
            } else {
              docsRef.current = [];
            }
          }
          const docMatches = (docsRef.current ?? [])
            .map((d) => ({
              d,
              s: rankBlob(q, `${d.title} ${d.category} ${d.author ?? ""} ${d.summary ?? ""}`),
            }))
            .filter((r) => r.s > 0)
            .sort((a, b) => b.s - a.s)
            .slice(0, 5);
          for (const { d } of docMatches) {
            results.push({
              kind: "doc",
              id: `doc:${d.title}`,
              title: d.title,
              subtitle: `${d.category}${d.author ? ` · ${d.author}` : ""}${d.date ? ` · ${d.date}` : ""}`,
              preview: d.summary,
              href: "/command-center/docs",
              meta: "Doc",
              accent: DOC_TINT,
            });
          }
        } catch {
          /* skip docs */
        }

        // Memory — fetch once, filter client-side across all entries.
        try {
          if (!memoryRef.current) {
            const res = await fetch("/api/command-center/memory?days=14", { cache: "no-store" });
            if (res.ok) {
              const data = (await res.json()) as MemoryResponse;
              memoryRef.current = data.days ?? [];
            } else {
              memoryRef.current = [];
            }
          }
          const memMatches: GlobalSearchResult[] = [];
          for (const day of memoryRef.current ?? []) {
            for (const e of day.entries ?? []) {
              const blob = `${e.title} ${e.content ?? ""} ${e.agent ?? ""}`;
              const s = rankBlob(q, blob);
              if (s <= 0) continue;
              memMatches.push({
                kind: "memory",
                id: `mem:${day.date}:${e.time ?? ""}:${e.title}`,
                title: e.title,
                subtitle: `${day.date}${e.time ? ` · ${e.time}` : ""}${e.agent ? ` · ${e.agent}` : ""}`,
                preview: e.content ? truncate(e.content, 120) : undefined,
                href: "/command-center/memory",
                meta: "Memory",
                accent: MEM_TINT,
              });
              if (memMatches.length >= 5) break;
            }
            if (memMatches.length >= 5) break;
          }
          results.push(...memMatches);
        } catch {
          /* skip memory */
        }

        if (id !== reqRef.current) return;
        setSnapshot({ query: q, loading: false, results, unavailable });
      })();
    }, 280);

    return () => window.clearTimeout(t);
  }, [query, enabled]);

  return snapshot;
}
