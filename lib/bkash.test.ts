import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/settings-cache", () => ({ getSettingsMap: vi.fn(async () => ({})) }));
vi.mock("@/db", () => ({
  db: {
    query: {
      siteSettings: {
        findFirst: vi.fn(async () => null),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(async () => {}),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {}),
    })),
  },
}));

import {
  createBkashPayment,
  executeBkashPayment,
  refundBkashPayment,
  isBkashConfigured,
  parseBkashConfig,
  resetBkashTokenCache,
  type BkashConfig,
} from "./bkash";

const config: BkashConfig = {
  enabled: true,
  mode: "sandbox",
  appKey: "key",
  appSecret: "secret",
  username: "user",
  password: "pass",
};

type Reply = Record<string, unknown>;

// Routes each bKash endpoint to a canned reply and records every call.
function mockBkash(replies: Record<string, Reply | (() => Reply)>) {
  const calls: { path: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace(/^.*\/tokenized\/checkout/, "");
      calls.push({
        path,
        body: JSON.parse(String(init.body)),
        headers: init.headers as Record<string, string>,
      });
      const reply = replies[path];
      if (!reply) throw new Error(`unexpected call ${path}`);
      const data = typeof reply === "function" ? reply() : reply;
      return new Response(JSON.stringify(data), { status: 200 });
    }),
  );
  return calls;
}

const token = { "/token/grant": { id_token: "tok", expires_in: 3600, statusCode: "0000" } };

beforeEach(() => resetBkashTokenCache());
afterEach(() => vi.unstubAllGlobals());

describe("parseBkashConfig", () => {
  it("defaults to disabled sandbox with empty credentials", () => {
    const parsed = parseBkashConfig({});
    expect(parsed.enabled).toBe(false);
    expect(parsed.mode).toBe("sandbox");
    expect(isBkashConfigured(parsed)).toBe(false);
  });

  it("reads the admin settings and trims credentials", () => {
    const parsed = parseBkashConfig({
      payment_method_bkash: "true",
      bkash_mode: "live",
      bkash_app_key: " k ",
      bkash_app_secret: "s",
      bkash_username: "u",
      bkash_password: "p",
    });
    expect(parsed).toEqual({ enabled: true, mode: "live", appKey: "k", appSecret: "s", username: "u", password: "p" });
    expect(isBkashConfigured(parsed)).toBe(true);
  });

  it("is not configured while any credential is missing", () => {
    expect(isBkashConfigured({ ...config, password: "" })).toBe(false);
  });
});

describe("createBkashPayment", () => {
  it("grants a token, then creates the payment with 2-decimal amount", async () => {
    const calls = mockBkash({
      ...token,
      "/create": { statusCode: "0000", paymentID: "P1", bkashURL: "https://pay.bka.sh/P1" },
    });
    const payment = await createBkashPayment(config, {
      amount: 1150,
      invoiceNumber: "ORD-1",
      callbackURL: "https://shop.test/api/bkash/callback/o1",
      payerReference: "01700000000",
    });
    expect(payment).toEqual({ paymentID: "P1", bkashURL: "https://pay.bka.sh/P1" });

    const grant = calls.find((c) => c.path === "/token/grant")!;
    expect(grant.headers.username).toBe("user");
    expect(grant.body).toEqual({ app_key: "key", app_secret: "secret" });

    const create = calls.find((c) => c.path === "/create")!;
    expect(create.headers.Authorization).toBe("tok");
    expect(create.headers["X-APP-Key"]).toBe("key");
    expect(create.body).toMatchObject({ amount: "1150.00", currency: "BDT", intent: "sale", merchantInvoiceNumber: "ORD-1" });
  });

  it("reuses the token across calls", async () => {
    const calls = mockBkash({
      ...token,
      "/create": { statusCode: "0000", paymentID: "P", bkashURL: "u" },
    });
    const input = { amount: 10, invoiceNumber: "A", callbackURL: "c", payerReference: "r" };
    await createBkashPayment(config, input);
    await createBkashPayment(config, input);
    expect(calls.filter((c) => c.path === "/token/grant")).toHaveLength(1);
  });

  it("surfaces bKash's message when credentials are rejected", async () => {
    mockBkash({ "/token/grant": { statusCode: "2001", statusMessage: "Invalid App Key" } });
    await expect(
      createBkashPayment(config, { amount: 10, invoiceNumber: "A", callbackURL: "c", payerReference: "r" }),
    ).rejects.toThrow("Invalid App Key");
  });

  it("throws when bKash refuses to create the payment", async () => {
    mockBkash({ ...token, "/create": { statusCode: "2023", statusMessage: "Insufficient Balance" } });
    await expect(
      createBkashPayment(config, { amount: 10, invoiceNumber: "A", callbackURL: "c", payerReference: "r" }),
    ).rejects.toThrow("Insufficient Balance");
  });
});

describe("executeBkashPayment", () => {
  const completed = {
    statusCode: "0000",
    transactionStatus: "Completed",
    paymentID: "P1",
    trxID: "TRX9",
    amount: "1150.00",
    merchantInvoiceNumber: "ORD-1",
  };

  it("returns the transaction for a completed payment", async () => {
    mockBkash({ ...token, "/execute": completed });
    expect(await executeBkashPayment(config, "P1")).toEqual({
      paymentID: "P1",
      trxID: "TRX9",
      amount: 1150,
      invoiceNumber: "ORD-1",
    });
  });

  it("throws errorMessageEn when payment does not complete, and DOES NOT call Query API", async () => {
    const calls = mockBkash({
      ...token,
      "/execute": {
        statusCode: "2023",
        transactionStatus: "Failed",
        errorMessageEn: "Insufficient Balance in Customer Wallet",
      },
    });

    await expect(executeBkashPayment(config, "P1")).rejects.toThrow(
      "Insufficient Balance in Customer Wallet",
    );
    // Checklist 4: Query Payment API must NOT be called if Execute API returned a response
    expect(calls.some((c) => c.path === "/payment/status")).toBe(false);
  });

  it("falls back to Query Payment API ONLY on timeout/no response", async () => {
    let executeAttempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = url.replace(/^.*\/tokenized\/checkout/, "");
        if (path === "/token/grant") {
          return new Response(JSON.stringify({ id_token: "tok", expires_in: 3600, statusCode: "0000" }), { status: 200 });
        }
        if (path === "/execute") {
          executeAttempts++;
          const timeoutErr = new Error("The operation was aborted due to timeout");
          timeoutErr.name = "TimeoutError";
          throw timeoutErr;
        }
        if (path === "/payment/status") {
          return new Response(JSON.stringify(completed), { status: 200 });
        }
        throw new Error(`Unexpected call: ${path}`);
      }),
    );

    const result = await executeBkashPayment(config, "P1");
    expect(executeAttempts).toBe(1);
    expect(result.trxID).toBe("TRX9");
    expect(result.paymentID).toBe("P1");
  });
});

describe("refundBkashPayment", () => {
  it("executes refund using stored id_token", async () => {
    const calls = mockBkash({
      ...token,
      "/payment/refund": {
        statusCode: "0000",
        statusMessage: "Successful",
        transactionStatus: "Completed",
        originalTrxID: "TRX9",
        refundTrxID: "REF999",
        amount: "500.00",
      },
    });

    const refund = await refundBkashPayment(config, {
      paymentID: "P1",
      trxID: "TRX9",
      amount: 500,
      reason: "Defective item",
    });

    expect(refund.statusCode).toBe("0000");
    expect(refund.refundTrxID).toBe("REF999");

    const refundCall = calls.find((c) => c.path === "/payment/refund")!;
    expect(refundCall.headers.Authorization).toBe("tok");
    expect(refundCall.headers["X-APP-Key"]).toBe("key");
    expect(refundCall.body).toMatchObject({
      paymentID: "P1",
      trxID: "TRX9",
      amount: "500.00",
      reason: "Defective item",
    });
  });

  it("throws errorMessageEn when bKash refund fails", async () => {
    mockBkash({
      ...token,
      "/payment/refund": {
        statusCode: "2068",
        statusMessage: "Transaction is not available for refund",
        errorMessageEn: "Transaction is not available for refund",
      },
    });

    await expect(
      refundBkashPayment(config, {
        paymentID: "P1",
        trxID: "TRX9",
        amount: 500,
      }),
    ).rejects.toThrow("Transaction is not available for refund");
  });
});
