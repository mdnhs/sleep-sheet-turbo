import { beforeEach, describe, expect, it } from "vitest";
import { alertKey, resetAlertThrottle, sanitizeAlertMessage, shouldSendAlert } from "@/lib/error-alert";

describe("shouldSendAlert", () => {
  beforeEach(() => resetAlertThrottle());

  it("sends the first alert for an error", () => {
    expect(shouldSendAlert("GET /api/x boom", 0)).toBe(true);
  });

  it("suppresses repeats inside the window", () => {
    shouldSendAlert("GET /api/x boom", 0);
    expect(shouldSendAlert("GET /api/x boom", 60_000)).toBe(false);
  });

  it("sends again once the window has passed", () => {
    shouldSendAlert("GET /api/x boom", 0);
    expect(shouldSendAlert("GET /api/x boom", 5 * 60_000)).toBe(true);
  });

  it("tracks different errors separately", () => {
    shouldSendAlert("GET /api/x boom", 0);
    expect(shouldSendAlert("POST /api/y bang", 1)).toBe(true);
  });
});

describe("sanitizeAlertMessage", () => {
  it("strips Drizzle's params dump so phones and emails never reach the alert", () => {
    const err = new Error("Failed query: select * from users where phone = $1\nparams: 01711111111,a@b.c");
    const out = sanitizeAlertMessage(err);
    expect(out).toBe("Failed query: select * from users where phone = $1");
    expect(out).not.toContain("01711111111");
  });

  it("prefers the cause message (the driver's real error)", () => {
    const err = new Error("Failed query: x\nparams: secret", { cause: new Error("connection refused") });
    expect(sanitizeAlertMessage(err)).toBe("connection refused");
  });

  it("strips params from the cause too and truncates to 300 chars", () => {
    const err = new Error("w", { cause: new Error(`${"a".repeat(400)}\nparams: secret`) });
    const out = sanitizeAlertMessage(err);
    expect(out).toHaveLength(300);
    expect(out).not.toContain("secret");
  });

  it("copes with non-Error throws", () => {
    expect(sanitizeAlertMessage("boom")).toBe("boom");
  });
});

describe("alertKey", () => {
  it("is stable across different query params in the same failure", () => {
    const a = Object.assign(new Error("Failed query: q\nparams: 1"), { name: "DrizzleQueryError" });
    const b = Object.assign(new Error("Failed query: q\nparams: 2"), { name: "DrizzleQueryError" });
    expect(alertKey("GET", "/api/x", a)).toBe(alertKey("GET", "/api/x", b));
  });

  it("separates by method, path and error kind", () => {
    const e = new TypeError("x");
    expect(alertKey("GET", "/api/x", e)).not.toBe(alertKey("POST", "/api/x", e));
    expect(alertKey("GET", "/api/x", e)).not.toBe(alertKey("GET", "/api/y", e));
    expect(alertKey("GET", "/api/x", e)).not.toBe(alertKey("GET", "/api/x", new RangeError("x")));
  });

  it("uses the cause's code when present", () => {
    const e1 = new Error("w", { cause: Object.assign(new Error("a"), { code: "ECONNREFUSED" }) });
    const e2 = new Error("w", { cause: Object.assign(new Error("a"), { code: "57P01" }) });
    expect(alertKey("GET", "/api/x", e1)).not.toBe(alertKey("GET", "/api/x", e2));
  });
});
