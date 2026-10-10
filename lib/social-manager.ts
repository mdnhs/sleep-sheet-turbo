/** The social manager link must be a plain http(s) address (or empty = not set up). */
export function isValidSocialManagerUrl(value: string): boolean {
  if (value === "") return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
