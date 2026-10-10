/** "+8801712345678" / "8801712345678" / "01712-345678" / "০১৭১২৩৪৫৬৭৮" -> "01712345678", or null if not a BD mobile. */
// Lives apart from lib/bdcourier.ts so client components can normalize a
// number before it becomes a query key — two spellings of one number must
// not become two cache entries, because each miss is a billed API call.
// Also used by checkout validation: customers on a Bangla keyboard type
// Bengali digits (০-৯), which `\d` doesn't match, so they're mapped first.
export function normalizeBdPhone(input: string): string | null {
  let digits = input
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/\D/g, "");
  if (digits.startsWith("880")) digits = digits.slice(2);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}
