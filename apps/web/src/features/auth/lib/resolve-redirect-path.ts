const FALLBACK = "/";
const LOGIN_PATH = "/login";
const BACKSLASH = 0x5c;
const LAST_CONTROL_CHARACTER = 0x1f;

/**
 * Where to go after signing in: the page `RequireAuth` bounced, read from `location.state`.
 * That state is not trusted: only a path inside this app is followed, so a crafted link
 * cannot turn the login into an open redirect.
 */
export function resolveRedirectPath(state: unknown): string {
  if (typeof state !== "object" || state === null || !("from" in state)) return FALLBACK;
  const { from } = state;
  if (typeof from !== "string" || !isInternalPath(from)) return FALLBACK;
  return from;
}

function isInternalPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  // Browsers read a backslash as a slash and drop line breaks, so "/\evil.com" leaves the app.
  for (let index = 0; index < path.length; index++) {
    const code = path.charCodeAt(index);
    if (code === BACKSLASH || code <= LAST_CONTROL_CHARACTER) return false;
  }
  return path !== LOGIN_PATH && !/^\/login[?#/]/.test(path);
}
