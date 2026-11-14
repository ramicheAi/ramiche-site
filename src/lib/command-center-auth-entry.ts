/**
 * Routes that ARE the credential entry points.
 *
 * `/command-center/unlock` (PIN on an already-enrolled device) and
 * `/command-center/bootstrap` (first-device secret or device-approval code)
 * must render with no cockpit shell and no client-side gate at all: they are
 * how a browser with no credential obtains one. The server-side middleware
 * already exempts them from the owner gate; this predicate keeps the client
 * layout consistent with that, so a brand-new device can reach the bootstrap
 * form instead of being stopped by a PIN prompt it cannot satisfy.
 */
export const AUTH_ENTRY_PATHS = ["/command-center/unlock", "/command-center/bootstrap"] as const;

export function isAuthEntryPath(pathname: string): boolean {
  return (AUTH_ENTRY_PATHS as readonly string[]).includes(pathname);
}
