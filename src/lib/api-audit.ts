/**
 * Lightweight API audit logging.
 * Logs request metadata for security monitoring and debugging.
 * Writes to stdout (captured by Vercel's log drain).
 */

interface AuditEntry {
  timestamp: string;
  route: string;
  method: string;
  ip: string;
  userAgent: string;
  status: number;
  durationMs: number;
}

/** Log an API request for auditing */
export function auditLog(req: Request, route: string, status: number, startTime: number): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    route,
    method: req.method,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    userAgent: (req.headers.get("user-agent") || "unknown").slice(0, 200),
    status,
    durationMs: Date.now() - startTime,
  };

  // Structured log — Vercel captures stdout as log entries
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

/** Wrap an API handler with automatic audit logging */
export function withAudit(route: string, handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const start = Date.now();
    try {
      const response = await handler(req);
      auditLog(req, route, response.status, start);
      return response;
    } catch (err) {
      auditLog(req, route, 500, start);
      throw err;
    }
  };
}
