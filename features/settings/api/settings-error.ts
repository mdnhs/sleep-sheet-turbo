/** A readable toast for a refused settings save (400/403 from PATCH /api/settings). */
export function settingsErrorMessage(body: unknown): string {
  const b = body as { error?: string; keys?: string[]; issues?: Record<string, string> } | null;
  if (b?.issues && Object.keys(b.issues).length > 0) {
    const details = Object.entries(b.issues).map(([key, message]) => `${key} (${message})`).join(", ");
    return `${b.error ?? "Invalid settings"}: ${details}`;
  }
  if (b?.keys?.length) return `${b.error ?? "Failed to save settings"}: ${b.keys.join(", ")}`;
  return b?.error ?? "Failed to save settings";
}
