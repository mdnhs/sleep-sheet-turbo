import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { getRequestOrigin } from "@/lib/request-origin";

describe("getRequestOrigin", () => {
  it("uses x-forwarded-host and x-forwarded-proto when present", async () => {
    const app = new Hono();
    let result = "";
    app.get("/test", (c) => {
      result = getRequestOrigin(c);
      return c.text("ok");
    });

    await app.request("http://0.0.0.0:3000/test", {
      headers: {
        "x-forwarded-host": "test.sleepsheetbd.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(result).toBe("https://test.sleepsheetbd.com");
  });

  it("handles multi-value x-forwarded-host header", async () => {
    const app = new Hono();
    let result = "";
    app.get("/test", (c) => {
      result = getRequestOrigin(c);
      return c.text("ok");
    });

    await app.request("http://0.0.0.0:3000/test", {
      headers: {
        "x-forwarded-host": "sleepsheetbd.com, 10.0.1.5",
        "x-forwarded-proto": "https",
      },
    });

    expect(result).toBe("https://sleepsheetbd.com");
  });

  it("ignores internal 0.0.0.0 host and falls back to NEXT_PUBLIC_APP_URL", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://test.sleepsheetbd.com";

    const app = new Hono();
    let result = "";
    app.get("/test", (c) => {
      result = getRequestOrigin(c);
      return c.text("ok");
    });

    await app.request("http://0.0.0.0:3000/test", {
      headers: {
        host: "0.0.0.0:3000",
      },
    });

    expect(result).toBe("https://test.sleepsheetbd.com");
    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
  });

  it("handles localhost in development", async () => {
    const app = new Hono();
    let result = "";
    app.get("/test", (c) => {
      result = getRequestOrigin(c);
      return c.text("ok");
    });

    await app.request("http://localhost:3001/test", {
      headers: {
        host: "localhost:3001",
      },
    });

    expect(result).toBe("http://localhost:3001");
  });
});
