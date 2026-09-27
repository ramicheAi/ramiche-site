/** Browser transport only. All authority is independently checked on the server. */
export async function cockpitFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
  const protectedPath = /^\/api\/(?:command-center|bridge)(?:\/|$)/.test(url.pathname) || url.pathname === '/api/auth/session';
  if (!protectedPath || url.origin !== window.location.origin) return fetch(input, init);
  const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const evidence = await fetch('/api/command-center/csrf', {credentials: 'same-origin', cache: 'no-store', redirect: 'error'});
    if (!evidence.ok) throw new Error('Authentication required. Please sign in again.');
    const body = await evidence.json();
    if (typeof body.token !== 'string' || !body.token) throw new Error('Security verification unavailable.');
    headers.set('x-parallax-csrf', body.token);
  }
  // Do not automatically retry mutations: CSRF is not an execution claim.
  return fetch(input, {...init, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error'});
}
