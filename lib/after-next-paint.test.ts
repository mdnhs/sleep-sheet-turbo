import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * afterNextPaint keeps analytics pushes out of the interaction that caused
 * them: queued work runs in order, after the next frame — or right away
 * where there is no frame to wait for, and before the page is left.
 */

type Listener = () => void;

function stubBrowser(visibility: "visible" | "hidden" = "visible") {
  const frames: Array<() => void> = [];
  const windowListeners = new Map<string, Listener[]>();
  const documentListeners = new Map<string, Listener[]>();
  const doc = {
    visibilityState: visibility,
    addEventListener: (type: string, fn: Listener) => {
      documentListeners.set(type, [...(documentListeners.get(type) ?? []), fn]);
    },
  };
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", {
    addEventListener: (type: string, fn: Listener) => {
      windowListeners.set(type, [...(windowListeners.get(type) ?? []), fn]);
    },
  });
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => {
    frames.push(fn);
    return frames.length;
  });
  return {
    doc,
    runFrame: () => frames.splice(0).forEach((fn) => fn()),
    fire: (target: "window" | "document", type: string) =>
      ((target === "window" ? windowListeners : documentListeners).get(type) ?? []).forEach((fn) => fn()),
  };
}

async function load() {
  vi.resetModules();
  return (await import("./after-next-paint")).afterNextPaint;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("afterNextPaint", () => {
  it("runs right away where there is no frame to wait for (server, tests)", async () => {
    const afterNextPaint = await load();
    const ran: string[] = [];
    afterNextPaint(() => ran.push("a"));
    expect(ran).toEqual(["a"]);
  });

  it("waits for the next frame and then a task, keeping order", async () => {
    const browser = stubBrowser();
    const afterNextPaint = await load();
    const ran: string[] = [];
    afterNextPaint(() => ran.push("a"));
    afterNextPaint(() => ran.push("b"));
    expect(ran).toEqual([]);

    browser.runFrame();
    expect(ran).toEqual([]); // still inside the frame: the paint hasn't happened

    vi.runAllTimers();
    expect(ran).toEqual(["a", "b"]);
  });

  it("flushes queued work when the page is hidden or left", async () => {
    const browser = stubBrowser();
    const afterNextPaint = await load();
    const ran: string[] = [];
    afterNextPaint(() => ran.push("a"));

    browser.doc.visibilityState = "hidden";
    browser.fire("document", "visibilitychange");
    expect(ran).toEqual(["a"]);

    afterNextPaint(() => ran.push("b"));
    expect(ran).toEqual(["a", "b"]); // hidden: no frame will come, run now

    browser.doc.visibilityState = "visible";
    afterNextPaint(() => ran.push("c"));
    browser.fire("window", "pagehide");
    expect(ran).toEqual(["a", "b", "c"]);

    // The frame scheduled for "c" later finds nothing left to run.
    browser.runFrame();
    vi.runAllTimers();
    expect(ran).toEqual(["a", "b", "c"]);
  });

  it("keeps running the queue when one task throws", async () => {
    stubBrowser("hidden");
    const afterNextPaint = await load();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ran: string[] = [];
    afterNextPaint(() => {
      throw new Error("boom");
    });
    afterNextPaint(() => ran.push("after"));
    expect(ran).toEqual(["after"]);
    expect(error).toHaveBeenCalled();
  });
});
