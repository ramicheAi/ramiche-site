import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("info uses console.log in dev", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("m", "ctx");
    expect(log).toHaveBeenCalled();
  });

  it("error uses console.error", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("e");
    expect(err).toHaveBeenCalled();
  });

  it("warn uses console.warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("w", "ctx");
    expect(warn).toHaveBeenCalled();
  });

  it("includes data in dev formatted output", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("m", "ctx", { k: 1 });
    expect(log.mock.calls[0][0]).toContain('"k":1');
  });
});

describe("logger production format", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("writes one JSON object per line in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logger: prodLogger } = await import("./logger");
    prodLogger.info("msg", "ctx");
    const line = log.mock.calls[0][0] as string;
    const parsed = JSON.parse(line) as {
      level: string;
      message: string;
      context?: string;
    };
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("msg");
    expect(parsed.context).toBe("ctx");
  });
});
