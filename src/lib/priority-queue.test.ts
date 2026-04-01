import { describe, it, expect, afterEach, vi } from "vitest";
import { PriorityQueue } from "./priority-queue";

async function drain() {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

describe("PriorityQueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes critical before low when ordered", async () => {
    const order: string[] = [];
    const q = new PriorityQueue<string>();
    q.setProcessor(async (item) => {
      order.push(item.id);
    });
    q.enqueue("c", "critical", "");
    q.enqueue("l", "low", "");
    await drain();
    expect(order).toEqual(["c", "l"]);
  });

  it("retries failed items", async () => {
    let n = 0;
    const q = new PriorityQueue<string>(2);
    q.setProcessor(async () => {
      n += 1;
      throw new Error("x");
    });
    q.enqueue("x", "normal", "");
    await drain();
    expect(n).toBe(3);
  });

  it("processes high before normal when higher priority is enqueued first", async () => {
    const order: string[] = [];
    const q = new PriorityQueue<string>();
    q.setProcessor(async (item) => {
      order.push(item.id);
    });
    q.enqueue("h", "high", "");
    q.enqueue("n", "normal", "");
    await drain();
    expect(order).toEqual(["h", "n"]);
  });

  it("FIFO within same priority by createdAt", async () => {
    vi.useFakeTimers();
    const t0 = Date.now();
    vi.setSystemTime(t0);
    const order: string[] = [];
    const q = new PriorityQueue<string>();
    q.setProcessor(async (item) => {
      order.push(item.id);
    });
    q.enqueue("first", "normal", "");
    vi.setSystemTime(t0 + 5);
    q.enqueue("second", "normal", "");
    await drain();
    expect(order).toEqual(["first", "second"]);
  });
});
