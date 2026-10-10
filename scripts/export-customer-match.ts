import { db } from "../db/index";
import { orders, users } from "../db/schema";
import fs from "fs";
import path from "path";

function normalizeBdPhone(input: unknown): string | null {
  if (!input) return null;
  const str = String(input).trim();
  const clean = str.replace(/[^\d+]/g, "");
  const match = clean.match(/(?:(?:\+?880)|0)?(1[3-9]\d{8})$/);
  if (match) {
    return "+880" + match[1];
  }
  return null;
}

function cleanEmail(input: unknown): string | null {
  if (!input) return null;
  const email = String(input).trim().toLowerCase();
  if (
    email.endsWith(".local") ||
    email.includes("@pos.") ||
    email.includes("@guest.") ||
    !email.includes("@") ||
    !email.includes(".")
  ) {
    return null;
  }
  return email;
}

function splitName(fullName: unknown): { first: string; last: string } {
  if (!fullName) return { first: "", last: "" };
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: "" };
  }
  return {
    first: parts.slice(0, -1).join(" "),
    last: parts[parts.length - 1],
  };
}

async function exportCustomerMatch() {
  const allOrders = await db
    .select({
      guestPhone: orders.guestPhone,
      guestName: orders.guestName,
      guestEmail: orders.guestEmail,
      shippingPostalCode: orders.shippingPostalCode,
    })
    .from(orders);

  const allUsers = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
    })
    .from(users);

  interface CustomerRecord {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    country: string;
    zip: string;
  }

  const customerMap = new Map<string, CustomerRecord>();

  for (const u of allUsers) {
    const phone = normalizeBdPhone(u.phone);
    const email = cleanEmail(u.email);
    if (!phone && !email) continue;
    const key = phone || (email as string);
    const { first, last } = splitName(u.name);
    customerMap.set(key, {
      email: email || "",
      phone: phone || "",
      firstName: first,
      lastName: last,
      country: "BD",
      zip: "",
    });
  }

  for (const o of allOrders) {
    let phone = normalizeBdPhone(o.guestPhone);
    let rawName = o.guestName;
    if (!phone && normalizeBdPhone(o.guestName)) {
      phone = normalizeBdPhone(o.guestName);
      rawName = o.guestPhone;
    }
    const email = cleanEmail(o.guestEmail);
    if (!phone && !email) continue;
    const key = phone || (email as string);
    const { first, last } = splitName(rawName);

    const existing = customerMap.get(key) || {
      email: email || "",
      phone: phone || "",
      firstName: first,
      lastName: last,
      country: "BD",
      zip: o.shippingPostalCode || "",
    };

    if (phone && !existing.phone) existing.phone = phone;
    if (email && !existing.email) existing.email = email;
    if (first && !existing.firstName) {
      existing.firstName = first;
      existing.lastName = last;
    }
    if (o.shippingPostalCode && !existing.zip) existing.zip = o.shippingPostalCode;

    customerMap.set(key, existing);
  }

  const rows = Array.from(customerMap.values());
  const header = "Email,Phone,First Name,Last Name,Country,Zip\n";
  const lines = rows.map((r) => {
    const escape = (val: string) => {
      if (!val) return "";
      const s = String(val).replace(/"/g, '""');
      return s.includes(",") ? `"${s}"` : s;
    };
    return `${escape(r.email)},${escape(r.phone)},${escape(r.firstName)},${escape(r.lastName)},${escape(r.country)},${escape(r.zip)}`;
  });

  const outputPath = path.join(process.cwd(), "google_ads_customer_match_sleep_sheet.csv");
  fs.writeFileSync(outputPath, header + lines.join("\n"), "utf8");

  console.log(`✅ Extracted ${rows.length} unique customers to: ${outputPath}`);
  console.log(`   - With valid phone (+880): ${rows.filter((r) => r.phone).length}`);
  console.log(`   - With valid email: ${rows.filter((r) => r.email).length}`);
}

exportCustomerMatch().catch((err) => {
  console.error("Export error:", err);
  process.exit(1);
});
