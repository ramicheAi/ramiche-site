/**
 * Change Data Capture pipeline for analytics (ByteByteGo #45).
 * Captures Firestore document changes and routes them to analytics.
 * Enables: engagement trends, retention metrics, feature usage tracking.
 */

interface ChangeEvent {
  collection: string;
  docId: string;
  type: "create" | "update" | "delete";
  timestamp: number;
  changes?: Record<string, { before: unknown; after: unknown }>;
  portal: string;
}

const CDC_BUFFER_SIZE = 20;
const CDC_FLUSH_INTERVAL_MS = 10_000;
const cdcBuffer: ChangeEvent[] = [];
let cdcFlushTimer: ReturnType<typeof setTimeout> | null = null;

export function captureChange(
  collection: string,
  docId: string,
  type: ChangeEvent["type"],
  portal: string,
  changes?: Record<string, { before: unknown; after: unknown }>
) {
  cdcBuffer.push({ collection, docId, type, timestamp: Date.now(), changes, portal });

  if (cdcBuffer.length >= CDC_BUFFER_SIZE) {
    flushCDC();
  } else if (!cdcFlushTimer) {
    cdcFlushTimer = setTimeout(flushCDC, CDC_FLUSH_INTERVAL_MS);
  }
}

function flushCDC() {
  if (cdcFlushTimer) { clearTimeout(cdcFlushTimer); cdcFlushTimer = null; }
  if (cdcBuffer.length === 0) return;

  const batch = cdcBuffer.splice(0, cdcBuffer.length);

  // In production, send to analytics endpoint or Firestore analytics collection
  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    import("./firebase").then(({ fbSet }) => {
      const batchId = `cdc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      fbSet(`analytics_cdc/${batchId}`, {
        events: batch as unknown as Record<string, unknown>[],
        count: batch.length,
        flushedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>).catch(() => {});
    });
  }
}

export function getCDCBufferSize(): number {
  return cdcBuffer.length;
}
