"use client";

/**
 * Shared finance truth for every surface that shows money.
 *
 * One request, one resolver, one set of rules. Before this hook, Sanctuary and Stage each carried
 * their own copy of "$48.2k" and Finance HQ carried `useState(48200)`, so the same screen could
 * show three different invented figures. Every consumer now reads the same measured state, and an
 * unavailable feed renders as unknown instead of a plausible number.
 *
 * Demo data is opt-in only (`?demo=1`) and is labelled DEMO by `sourceBadge` / `financeProvenance`.
 */

import { useEffect, useState } from "react";

import {
  INITIAL_STATE,
  isDemoRequested,
  resolveFinanceState,
  type FinanceState,
  type StripeRevenuePayload,
} from "@/lib/finance-truth";

export type FinanceTruthResult = FinanceState & {
  /** Re-read the revenue endpoint. Exposed so a surface can offer an explicit refresh. */
  refresh: () => void;
};

export function useFinanceTruth(): FinanceTruthResult {
  const [state, setState] = useState<FinanceState>(INITIAL_STATE);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const demo =
      typeof window !== "undefined" ? isDemoRequested(window.location.search) : false;

    fetch("/api/command-center/stripe-revenue", {
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        // A non-2xx answer is not an empty ledger. Treat it as unavailable with its reason.
        if (!res.ok) {
          throw new Error(`revenue endpoint returned ${res.status}`);
        }
        return (await res.json()) as StripeRevenuePayload;
      })
      .then((payload) => {
        if (cancelled) return;
        setState(resolveFinanceState(payload, demo));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        // An explicit ?demo=1 must still render the labelled demo, otherwise any 500 or 401
        // silently removes the only state the caller asked for.
        if (demo) {
          setState(resolveFinanceState(null, true));
        } else {
          setState({
            ...INITIAL_STATE,
            source: "unavailable",
            reason: err instanceof Error ? err.message : "Revenue request failed.",
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nonce]);

  return { ...state, refresh: () => setNonce((n) => n + 1) };
}
