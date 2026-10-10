// An anonymous, stable id for this browser — what lets a guest like a video
// once (and take the like back) without signing in. It is only a random id kept
// in localStorage: no personal data, and clearing site data simply makes the
// visitor "new" again.
const KEY = "ss_visitor_id";
let fallback: string | null = null;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Storage blocked (private mode, etc.): stable for this page view at least.
    fallback ??= randomId();
    return fallback;
  }
}
