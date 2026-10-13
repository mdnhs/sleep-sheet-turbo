export interface AdFiles {
  html: string;
  css: string;
  js: string;
}

const STYLE_BLOCK = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi;
const INLINE_SCRIPT_BLOCK = /<script(?![^>]*\ssrc\b)(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;

const trimBlock = (value: string) => value.replace(/^\s*\n|\s+$/g, "");

// The saved ad stays a single HTML string (what the storefront frame renders);
// the editor's three files are pulled out of it and put back on save.
export function splitAdCode(code: string): AdFiles {
  const css: string[] = [];
  const js: string[] = [];
  const html = code
    .replace(STYLE_BLOCK, (_, body: string) => (css.push(trimBlock(body)), ""))
    .replace(INLINE_SCRIPT_BLOCK, (_, body: string) => (js.push(trimBlock(body)), ""));
  return { html: html.replace(/\n{3,}/g, "\n\n").trim(), css: css.join("\n\n"), js: js.join("\n\n") };
}

export function composeAdCode({ html, css, js }: AdFiles): string {
  return [
    css.trim() && `<style>\n${trimBlock(css)}\n</style>`,
    html.trim(),
    js.trim() && `<script>\n${trimBlock(js)}\n</script>`,
  ]
    .filter(Boolean)
    .join("\n");
}
