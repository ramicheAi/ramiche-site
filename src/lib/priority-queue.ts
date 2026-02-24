/**
 * Priority queue for task processing (ByteByteGo #41).
 * Critical tasks preempt nice-to-haves. Used for background
 * processing like Firestore sync, analytics batching, etc.
 */

type Priority = "critical" | "high" | "normal" | "low";

interface QueueItem<T = unknown> {
  id: string;
  priority: Priority;
  data: T;
  createdAt: number;
  retries: number;
}

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

export class PriorityQueue<T = unknown> {
  private items: QueueItem<T>[] = [];
  private processing = false;
  private processor: ((item: QueueItem<T>) => Promise<void>) | null = null;
  private maxRetries: number;

  constructor(maxRetries = 3) {
    this.maxRetries = maxRetries;
  }

  enqueue(id: string, priority: Priority, data: T) {
    this.items.push({ id, priority, data, createdAt: Date.now(), retries: 0 });
    this.items.sort((a, b) => {
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pDiff !== 0) return pDiff;
      return a.createdAt - b.createdAt; // FIFO within same priority
    });
    if (this.processor && !this.processing) this.processNext();
  }

  setProcessor(fn: (item: QueueItem<T>) => Promise<void>) {
    this.processor = fn;
  }

  get length() { return this.items.length; }
  get isProcessing() { return this.processing; }

  private async processNext() {
    if (!this.processor || this.items.length === 0) {
      this.processing = false;
      return;
    }
    this.processing = true;
    const item = this.items.shift()!;
    try {
      await this.processor(item);
    } catch {
      if (item.retries < this.maxRetries) {
        item.retries++;
        item.priority = item.priority === "critical" ? "critical" : "high"; // escalate on retry
        this.items.unshift(item);
      }
    }
    this.processNext();
  }
}
