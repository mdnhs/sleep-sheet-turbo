/**
 * Run `fn` once the window `load` event has fired and the main thread is idle,
 * so non-critical work (autoplaying videos, heavy widgets) never competes with
 * the first paint. Returns a cancel function for effect cleanup.
 */
export function afterLoadIdle(fn: () => void, timeout = 3_000): () => void {
  let idleId: number | undefined;
  let timerId: number | undefined;

  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(fn, { timeout });
    } else {
      timerId = window.setTimeout(fn, 1_000);
    }
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });

  return () => {
    window.removeEventListener("load", schedule);
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    if (timerId !== undefined) window.clearTimeout(timerId);
  };
}
