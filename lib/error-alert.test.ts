import { beforeEach, describe, expect, it } from "vitest";
import { resetAlertThrottle, shouldSendAlert } from "@/lib/error-alert";

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
