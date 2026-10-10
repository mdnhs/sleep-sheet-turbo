import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

// Minimal fake matching just the shape rate-limit.ts's middleware reads off
// a Hono Context: c.req.header() and c.json(). Enough to exercise the
// middleware without pulling in a real Hono app/request.
function fakeContext(ip: string) {
  const headers: Record<string, string> = { "x-forwarded-for": ip };
  return {
    req: { header: (name: string) => headers[name] },
    json: (body: unknown, status: number) => ({ body, status }),
  };
}

describe("rateLimit", () => {
  it("allows requests under the limit", async () => {
    const middleware = rateLimit(`test-${Math.random()}`, 3, 60_000);
    const c = fakeContext("1.1.1.1");
    let nextCalls = 0;
    for (let i = 0; i < 3; i++) {
      const result = await middleware(c as never, async () => {
        nextCalls++;
      });
      expect(result).toBeUndefined();
    }
    expect(nextCalls).toBe(3);
  });

  it("blocks the request once the limit is exceeded", async () => {
    const middleware = rateLimit(`test-${Math.random()}`, 2, 60_000);
    const c = fakeContext("2.2.2.2");
    const next = async () => {};

    await middleware(c as never, next);
    await middleware(c as never, next);
    const blocked = await middleware(c as never, next);

    expect(blocked).toEqual({ body: { message: expect.any(String) }, status: 429 });
  });

  it("tracks each client IP independently", async () => {
    const middleware = rateLimit(`test-${Math.random()}`, 1, 60_000);
    const next = async () => {};

    const first = await middleware(fakeContext("3.3.3.3") as never, next);
    const second = await middleware(fakeContext("4.4.4.4") as never, next);

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
  });
});
