import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie, verifySessionCookie, revokeSession } from '@/lib/firebase-admin';
import { readSessionCookieValues, SESSION_COOKIE } from '@/lib/server/owner-identity';
import { verifyExactOrigin } from '@/lib/server/origin-guard';
import { CSRF_HEADER, issueCsrfToken, verifyCsrfToken } from '@/lib/server/csrf';

const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
const json = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: {'cache-control': 'no-store'}});
function cookieOf(req: NextRequest): string | null {
  const values = readSessionCookieValues(req);
  return values.length === 1 && /^[A-Za-z0-9._-]{20,8192}$/.test(values[0]) ? values[0] : null;
}

/** Login bootstrap: exact Origin + non-simple custom header + fresh verified ID token.
 * Never accepts a form submission or a cross-origin redirect as login evidence.
 * This shared session endpoint does not itself grant cockpit authority.
 */
export async function POST(req: NextRequest) {
  const origin = verifyExactOrigin(req);
  if (!origin.ok) return json({error: 'denied', reason: origin.reason}, origin.status);
  if (req.headers.get('x-parallax-session-exchange') !== '1' || req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({error: 'Invalid session exchange evidence'}, 403);
  if (!issueCsrfToken('configuration-check').ok) return json({error: 'Security configuration unavailable'}, 503);
  try {
    const body = await req.json();
    if (!body || typeof body.idToken !== 'string' || body.idToken.length > 16384) return json({error: 'Invalid ID token'}, 400);
    const cookie = await createSessionCookie(body.idToken, SESSION_DURATION_MS);
    if (!cookie) return json({error: 'Session could not be verified'}, 401);
    const csrf = issueCsrfToken(cookie);
    if (!csrf.ok) return json({error: 'Security configuration unavailable'}, 503);
    const response = json({status: 'ok', csrfToken: csrf.token, csrfExpiresAt: csrf.expiresAt});
    response.cookies.set(SESSION_COOKIE, cookie, {httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: SESSION_DURATION_MS / 1000, path: '/'});
    return response;
  } catch { return json({error: 'Invalid request'}, 400); }
}
export async function GET(req: NextRequest) {
  const cookie = cookieOf(req);
  const user = cookie ? await verifySessionCookie(cookie) : null;
  return user ? json({authenticated: true, uid: user.uid}) : json({authenticated: false}, 401);
}
export async function DELETE(req: NextRequest) {
  const origin = verifyExactOrigin(req);
  if (!origin.ok) return json({error: 'denied', reason: origin.reason}, origin.status);
  const cookie = cookieOf(req);
  const user = cookie ? await verifySessionCookie(cookie) : null;
  if (!cookie || !user) return json({error: 'Invalid session'}, 401);
  const csrf = verifyCsrfToken(req.headers.get(CSRF_HEADER), cookie);
  if (!csrf.ok) return json({error: 'denied', reason: csrf.reason}, csrf.status);
  if (!await revokeSession(user.uid)) return json({error: 'Revocation could not be verified'}, 503);
  const response = json({status: 'signed_out'});
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
