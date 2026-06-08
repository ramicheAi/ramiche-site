"use client";

/**
 * Agent Output Gallery — `/command-center/gallery`
 *
 * Every image any agent has ever generated in any channel, in one grid view.
 * Filter by agent, channel, date range. Click any image to open the same
 * fullscreen lightbox the chat uses (Download / Copy / Close).
 *
 * Why this exists: chat is great for "live work" but bad for asset retrieval.
 * Two days after an image was generated, you can't remember which channel /
 * thread / day it was in. This page is the persistent catalogue.
 *
 * Data shape: queries the `messages` table for rows with non-empty
 * `attachments`, flattens to one card per attachment, sorts newest first.
 * Filters happen client-side so navigation is instant once the initial fetch
 * lands. For a channel with 100k messages we'd page server-side, but right
 * now we cap the initial pull at 500 rows which is plenty.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { AGENT_UUID_TO_SHORT_ID } from "@/lib/cc-agent-dm-uuids";

type GalleryAttachment = {
  url: string;
  name: string;
  type: string;
  prompt?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  via?: string;
};

type GalleryImage = {
  /** Synthetic id: messageId + attachment-index, used as React key. */
  key: string;
  messageId: string;
  channelId: string;
  channelName: string;
  agentShortId: string;
  agentName: string;
  createdAt: string;
  attachment: GalleryAttachment;
};

const COLORS = {
  bg: "#0a0a14",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  text: { primary: "#e2e8f0", secondary: "#94a3b8", tertiary: "#64748b" },
  accent: { purple: "#7c3aed", purpleLight: "#a78bfa" },
};

const AGENT_COLORS: Record<string, string> = {
  atlas: "#C9A84C",
  triage: "#34d399",
  shuri: "#22d3ee",
  proximon: "#60a5fa",
  aetherion: "#f59e0b",
  simons: "#a78bfa",
  mercury: "#ef4444",
  vee: "#ec4899",
  ink: "#f97316",
  echo: "#10b981",
  haven: "#06b6d4",
  widow: "#dc2626",
  drstrange: "#8b5cf6",
  kiyosaki: "#84cc16",
  michael: "#3b82f6",
  selah: "#f43f5e",
  prophets: "#fbbf24",
  themaestro: "#a855f7",
  nova: "#06b6d4",
  themis: "#94a3b8",
};

function formatBytes(n?: number): string | null {
  if (!n || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 102.4) / 10} KB`;
  return `${Math.round(n / 104857.6) / 10} MB`;
}

async function downloadBlob(url: string, filename: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

async function copyToClipboard(url: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write) return false;
    const res = await fetch(url, { cache: "no-store" });
    const blob = await res.blob();
    let writable = blob;
    if (blob.type !== "image/png") {
      const img = document.createElement("img");
      const oUrl = URL.createObjectURL(blob);
      img.src = oUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("decode failed"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      ctx.drawImage(img, 0, 0);
      writable = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob null"))), "image/png");
      });
      URL.revokeObjectURL(oUrl);
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": writable })]);
    return true;
  } catch {
    return false;
  }
}

export default function GalleryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);
  // "Now" captured at mount via lazy state-init so it's a stable component
  // value (satisfies react-hooks/purity) but still wall-clock-accurate for
  // the page session. Reload to refresh the "last 24h" window if you've
  // had the page open for >24h, which is fine.
  const [nowTs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!supabase) {
      setError("Supabase client not configured");
      setLoading(false);
      return;
    }
    const sb = supabase;
    (async () => {
      const { data: msgs, error: msgErr } = await sb
        .from("messages")
        .select("id, channel_id, sender_agent_id, attachments, created_at, content")
        .not("attachments", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (msgErr) {
        setError(msgErr.message);
        setLoading(false);
        return;
      }
      // Pull channel names in one extra query so the UI can show
      // "#content-team" instead of raw UUIDs.
      const { data: channels } = await sb.from("channels").select("id, name");
      const channelById = new Map<string, string>();
      for (const c of channels || []) {
        channelById.set(c.id as string, (c.name as string) || (c.id as string).slice(0, 8));
      }

      const flat: GalleryImage[] = [];
      for (const row of msgs || []) {
        const atts = Array.isArray(row.attachments) ? row.attachments : [];
        for (let i = 0; i < atts.length; i++) {
          const a = atts[i] as GalleryAttachment;
          if (!a || !a.url) continue;
          const isImage =
            (a.type || "").startsWith("image/") ||
            a.type === "image" ||
            /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(a.name || "");
          if (!isImage) continue;
          const agentUuid = (row.sender_agent_id as string) || "";
          const agentShortId = AGENT_UUID_TO_SHORT_ID[agentUuid] || "agent";
          flat.push({
            key: `${row.id}-${i}`,
            messageId: row.id as string,
            channelId: row.channel_id as string,
            channelName: channelById.get(row.channel_id as string) || "channel",
            agentShortId,
            agentName: agentShortId.charAt(0).toUpperCase() + agentShortId.slice(1),
            createdAt: row.created_at as string,
            attachment: a,
          });
        }
      }
      setImages(flat);
      setLoading(false);
    })();
  }, []);

  const agents = useMemo(() => {
    const s = new Set<string>();
    for (const img of images) s.add(img.agentShortId);
    return ["all", ...Array.from(s).sort()];
  }, [images]);

  const channels = useMemo(() => {
    const s = new Map<string, string>();
    for (const img of images) s.set(img.channelId, img.channelName);
    return [
      { id: "all", name: "All channels" },
      ...Array.from(s.entries()).map(([id, name]) => ({ id, name })),
    ];
  }, [images]);

  const filtered = useMemo(() => {
    return images.filter((img) => {
      if (agentFilter !== "all" && img.agentShortId !== agentFilter) return false;
      if (channelFilter !== "all" && img.channelId !== channelFilter) return false;
      if (dateFilter !== "all") {
        const ts = new Date(img.createdAt).getTime();
        const dayMs = 86400_000;
        const window =
          dateFilter === "today" ? dayMs : dateFilter === "week" ? 7 * dayMs : 30 * dayMs;
        if (nowTs - ts > window) return false;
      }
      return true;
    });
  }, [images, agentFilter, channelFilter, dateFilter, nowTs]);

  const total = images.length;
  const shown = filtered.length;

  const selectStyle: CSSProperties = {
    padding: "6px 10px",
    fontSize: 12,
    background: COLORS.card,
    color: COLORS.text.primary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text.primary,
        padding: "32px 24px 64px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <Link href="/command-center/chat" style={{ color: COLORS.accent.purpleLight, fontSize: 11, textDecoration: "none", letterSpacing: 0.6, textTransform: "uppercase" }}>
              ← Back to chat
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "8px 0 4px", color: COLORS.text.primary }}>
              Agent Output Gallery
            </h1>
            <div style={{ fontSize: 12, color: COLORS.text.tertiary }}>
              {loading ? "Loading…" : `${shown} of ${total} images across the command center`}
            </div>
          </div>
        </div>

        {/* Filter row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} style={selectStyle}>
            {agents.map((id) => (
              <option key={id} value={id}>
                {id === "all" ? "All agents" : `@${id}`}
              </option>
            ))}
          </select>
          <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} style={selectStyle}>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id === "all" ? c.name : `#${c.name}`}
              </option>
            ))}
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} style={selectStyle}>
            <option value="all">All time</option>
            <option value="today">Last 24h</option>
            <option value="week">Last 7d</option>
            <option value="month">Last 30d</option>
          </select>
        </div>

        {/* Grid */}
        {error ? (
          <div style={{ padding: 32, textAlign: "center", color: "#f87171" }}>Error: {error}</div>
        ) : loading ? (
          <div style={{ padding: 48, textAlign: "center", color: COLORS.text.tertiary }}>Loading gallery…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 64, textAlign: "center", color: COLORS.text.tertiary }}>
            {total === 0 ? (
              <>No agent-generated images yet. Send <code style={{ color: COLORS.accent.purpleLight }}>@aetherion ship a launch hook visual with a [GENERATE_IMAGE: …] marker</code> in any channel and it&apos;ll show up here.</>
            ) : (
              "No images match the current filters."
            )}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {filtered.map((img) => (
              <GalleryCard key={img.key} image={img} nowTs={nowTs} onOpen={() => setLightbox(img)} />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            cursor: "zoom-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8, cursor: "auto" }}
          >
            <button
              type="button"
              onClick={() => void downloadBlob(lightbox.attachment.url, lightbox.attachment.name)}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
                cursor: "pointer",
              }}
            >
              ⬇ Download
            </button>
            <button
              type="button"
              onClick={async () => void (await copyToClipboard(lightbox.attachment.url))}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
                cursor: "pointer",
              }}
            >
              📋 Copy
            </button>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
                cursor: "pointer",
              }}
            >
              ✕ Close
            </button>
          </div>
          <img
            src={lightbox.attachment.url}
            alt={lightbox.attachment.name}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "92vw",
              maxHeight: "78vh",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
              cursor: "auto",
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "monospace", maxWidth: "90vw", textAlign: "center", cursor: "auto" }}
          >
            {lightbox.attachment.name} · @{lightbox.agentShortId} · #{lightbox.channelName}
          </div>
          {lightbox.attachment.prompt && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "monospace", maxWidth: "70vw", textAlign: "center", lineHeight: 1.5, cursor: "auto" }}
            >
              {lightbox.attachment.prompt}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GalleryCard({
  image,
  nowTs,
  onOpen,
}: {
  image: GalleryImage;
  nowTs: number;
  onOpen: () => void;
}) {
  const a = image.attachment;
  const [hovered, setHovered] = useState(false);
  const agentColor = AGENT_COLORS[image.agentShortId] || COLORS.text.secondary;
  const when = new Date(image.createdAt);
  const niceDate =
    nowTs - when.getTime() < 86400_000
      ? when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : when.toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{ cursor: "zoom-in", aspectRatio: "1 / 1", overflow: "hidden", background: "#000" }}
        onClick={onOpen}
        title={a.prompt || a.name}
      >
        <img
          src={a.url}
          alt={a.name}
          loading="lazy"
          draggable
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            display: "flex",
            gap: 4,
          }}
        >
          <button
            type="button"
            title="Download"
            onClick={(e) => {
              e.stopPropagation();
              void downloadBlob(a.url, a.name);
            }}
            style={{
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 600,
              borderRadius: 4,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(0,0,0,0.78)",
              color: "#fff",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            ⬇
          </button>
          <button
            type="button"
            title="Copy to clipboard"
            onClick={async (e) => {
              e.stopPropagation();
              await copyToClipboard(a.url);
            }}
            style={{
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 600,
              borderRadius: 4,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(0,0,0,0.78)",
              color: "#fff",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            📋
          </button>
        </div>
      )}
      <div
        style={{
          padding: "8px 10px",
          fontSize: 11,
          color: COLORS.text.tertiary,
          borderTop: `1px solid ${COLORS.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ color: agentColor, fontWeight: 600 }}>@{image.agentShortId}</span>
          <span style={{ fontSize: 10, color: COLORS.text.tertiary }}>{niceDate}</span>
        </div>
        <div
          style={{
            color: COLORS.text.secondary,
            fontSize: 10,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          #{image.channelName}
          {a.width && a.height ? ` · ${a.width}×${a.height}` : ""}
          {formatBytes(a.sizeBytes) ? ` · ${formatBytes(a.sizeBytes)}` : ""}
        </div>
      </div>
    </div>
  );
}
