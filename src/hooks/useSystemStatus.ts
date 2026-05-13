"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ServiceState = "ok" | "degraded" | "offline" | "unknown";

export interface AgentsSnapshot {
  active: number;
  total: number;
  state: ServiceState;
  updatedAt: string;
}

export interface GatewaySnapshot {
  state: ServiceState;
  raw?: unknown;
  updatedAt: string;
}

export interface RevenueSnapshot {
  mrr: number;
  arr: number;
  last30: number;
  state: ServiceState;
  updatedAt: string;
}

export interface NetworkSnapshot {
  online: boolean;
  state: ServiceState;
}

export interface SystemStatus {
  agents: AgentsSnapshot;
  gateway: GatewaySnapshot;
  revenue: RevenueSnapshot;
  network: NetworkSnapshot;
  refresh: () => void;
}

const EMPTY_AGENTS: AgentsSnapshot = { active: 0, total: 0, state: "unknown", updatedAt: "" };
const EMPTY_GATEWAY: GatewaySnapshot = { state: "unknown", updatedAt: "" };
const EMPTY_REVENUE: RevenueSnapshot = {
  mrr: 0,
  arr: 0,
  last30: 0,
  state: "unknown",
  updatedAt: "",
};

interface AgentsResponse {
  agents?: unknown[];
  count?: number;
  activeCount?: number;
  source?: string;
}

interface RevenueResponse {
  subscriptions?: { mrr?: number; arr?: number; active?: number };
  revenue?: { last30Days?: number };
  source?: string;
}

async function safeFetch<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Polls Command Center telemetry endpoints. Use once at the layout level — caches via passed refresh tokens. */
export function useSystemStatus(): SystemStatus {
  const [agents, setAgents] = useState<AgentsSnapshot>(EMPTY_AGENTS);
  const [gateway, setGateway] = useState<GatewaySnapshot>(EMPTY_GATEWAY);
  const [revenue, setRevenue] = useState<RevenueSnapshot>(EMPTY_REVENUE);
  const [network, setNetwork] = useState<NetworkSnapshot>({
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    state: typeof navigator === "undefined" ? "unknown" : navigator.onLine ? "ok" : "offline",
  });

  const tokenRef = useRef(0);

  const pull = useCallback(async () => {
    const token = ++tokenRef.current;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
      const [a, r, g] = await Promise.all([
        safeFetch<AgentsResponse>("/api/command-center/agents", ctrl.signal),
        safeFetch<RevenueResponse>("/api/command-center/revenue", ctrl.signal),
        safeFetch<{ ok?: boolean; configured?: boolean; reachable?: boolean }>(
          "/api/command-center/settings",
          ctrl.signal
        ),
      ]);
      if (token !== tokenRef.current) return;

      const now = new Date().toISOString();

      if (a) {
        const total = typeof a.count === "number" ? a.count : Array.isArray(a.agents) ? a.agents.length : 0;
        const active = typeof a.activeCount === "number" ? a.activeCount : 0;
        setAgents({
          active,
          total,
          state: total === 0 ? "degraded" : active === 0 ? "degraded" : "ok",
          updatedAt: now,
        });
      } else {
        setAgents((prev) => ({ ...prev, state: "offline", updatedAt: now }));
      }

      if (r) {
        const mrr = typeof r.subscriptions?.mrr === "number" ? r.subscriptions.mrr : 0;
        const arr = typeof r.subscriptions?.arr === "number" ? r.subscriptions.arr : 0;
        const last30 = typeof r.revenue?.last30Days === "number" ? r.revenue.last30Days : 0;
        const state: ServiceState = r.source === "unavailable" ? "degraded" : "ok";
        setRevenue({ mrr, arr, last30, state, updatedAt: now });
      } else {
        setRevenue((prev) => ({ ...prev, state: "offline", updatedAt: now }));
      }

      if (g) {
        let state: ServiceState = "unknown";
        if (g.ok && g.reachable) state = "ok";
        else if (g.configured) state = "degraded";
        else state = "offline";
        setGateway({ state, raw: g, updatedAt: now });
      } else {
        setGateway({ state: "offline", updatedAt: now });
      }
    } finally {
      clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    void pull();
    const id = window.setInterval(() => {
      void pull();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [pull]);

  useEffect(() => {
    const onOnline = () => setNetwork({ online: true, state: "ok" });
    const onOffline = () => setNetwork({ online: false, state: "offline" });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const refresh = useCallback(() => {
    void pull();
  }, [pull]);

  return { agents, gateway, revenue, network, refresh };
}
