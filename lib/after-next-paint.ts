// Work that has to happen, but not inside the interaction that triggered it —
// analytics pushes, mainly. GTM runs the tags an event triggers synchronously
// inside dataLayer.push(), so a push from a click handler made the Meta pixel
// and both gtag runtimes part of that tap's processing time (INP). Queued
// tasks run in order, in one task, after the browser has painted the
// interaction's result; and before the page is hidden or left, so nothing
// queued is lost.

const queue: Array<() => void> = [];
let scheduled = false;
let listening = false;

function flush(): void {
  scheduled = false;
  for (const task of queue.splice(0)) {
    try {
      task();
    } catch (error) {
      console.error("[afterNextPaint] task failed:", error);
    }
  }
}

export function afterNextPaint(task: () => void): void {
  // Nothing to wait for: on the server and in tests there is no frame, and a
  // hidden tab may never produce one. Earlier queued work still goes first.
  if (
    typeof requestAnimationFrame !== "function" ||
    typeof document === "undefined" ||
    document.visibilityState === "hidden"
  ) {
    queue.push(task);
    flush();
    return;
  }

  queue.push(task);
  if (!listening) {
    listening = true;
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }
  if (scheduled) return;
  scheduled = true;
  // A frame callback runs just before the paint; the task it queues runs
  // after it.
  requestAnimationFrame(() => setTimeout(flush, 0));
}
