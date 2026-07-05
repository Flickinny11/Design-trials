// PRISM SHELL — COLLAB CHANNEL CONFIG (SHELL W7, deviation W7-D1)
//
// The CollabRoom endpoint is config-driven (like model-config / usage-config):
// a data change, not a code change, points the client at the local dev host,
// a staging host, or the production Cloudflare Durable Object
// (`wss://<host>/collab/<projectId>`). Absent config, the local dev default is
// used. Returning null disables the channel entirely (the multiplayer surface
// then never mounts — the SSE-only baseline).

const DEFAULT_DEV_URL = 'ws://localhost:4790';

/** Base ws origin for the collab host, or null when disabled. */
export function getCollabBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_PRISM_COLLAB_URL;
  if (configured === 'off') return null;
  if (configured && configured.length > 0) return configured.replace(/\/$/, '');
  // Dev default: same host, the collab port.
  return DEFAULT_DEV_URL;
}

/** Full room URL for a project, or null when the channel is disabled. */
export function getCollabRoomUrl(projectId: string): string | null {
  const base = getCollabBaseUrl();
  if (!base) return null;
  return `${base}/collab/${encodeURIComponent(projectId)}`;
}
