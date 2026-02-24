/**
 * Structured logging for METTLE (12-Factor App Principle #11).
 * JSON-formatted logs with severity, context, and timestamps.
 * Outputs to console in development, structured JSON in production.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  userId?: string;
  requestId?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL = process.env.NODE_ENV === "production" ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }
  const prefix = `[${entry.level.toUpperCase()}]`;
  const ctx = entry.context ? ` (${entry.context})` : "";
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  return `${prefix}${ctx} ${entry.message}${data}`;
}

function log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    data,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (msg: string, ctx?: string, data?: Record<string, unknown>) => log("debug", msg, ctx, data),
  info: (msg: string, ctx?: string, data?: Record<string, unknown>) => log("info", msg, ctx, data),
  warn: (msg: string, ctx?: string, data?: Record<string, unknown>) => log("warn", msg, ctx, data),
  error: (msg: string, ctx?: string, data?: Record<string, unknown>) => log("error", msg, ctx, data),
};
