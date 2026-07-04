// PRISM SHELL — post-auth destination sanitizer (SHELL W1A)
//
// `?next=` must only ever be a same-origin in-app path: no absolute URLs,
// no protocol-relative `//host`, no backslash tricks. Anything else lands
// on the dashboard.

export const DEFAULT_POST_AUTH_PATH = '/app';

export function safeNextPath(next: string | undefined | null): string {
  if (!next) return DEFAULT_POST_AUTH_PATH;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return DEFAULT_POST_AUTH_PATH;
  }
  return next;
}
