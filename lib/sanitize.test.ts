import { describe, it, expect } from "vitest";
import { sanitizeRichText, zRichText } from "./sanitize";

describe("sanitizeRichText", () => {
  it("strips script tags and their contents", () => {
    // Not just the tag: dropping only the tag would render `alert(1)` as
    // visible body copy.
    expect(sanitizeRichText("<p>hi</p><script>alert(1)</script>")).toBe("<p>hi</p>");
  });

  it("strips event-handler attributes", () => {
    expect(sanitizeRichText(`<img src="https://x/a.png" onerror="alert(1)">`))
      .toBe(`<img src="https://x/a.png" />`);
    expect(sanitizeRichText(`<p onclick="alert(1)">t</p>`)).toBe("<p>t</p>");
  });

  it("strips javascript: and data: URIs", () => {
    expect(sanitizeRichText(`<a href="javascript:alert(1)">x</a>`)).toBe("<a>x</a>");
    expect(sanitizeRichText(`<img src="data:text/html;base64,PHN2Zz4=">`)).toBe("<img />");
  });

  it("strips iframes, objects and embeds", () => {
    expect(sanitizeRichText(`<iframe src="https://evil.test"></iframe><p>t</p>`)).toBe("<p>t</p>");
    expect(sanitizeRichText(`<object data="x"></object><p>t</p>`)).toBe("<p>t</p>");
  });

  it("strips svg, which can carry script", () => {
    expect(sanitizeRichText(`<svg><script>alert(1)</script></svg><p>t</p>`)).toBe("<p>t</p>");
  });

  // Everything below appears in production rows today. If the allowlist ever
  // narrows, real published content silently loses formatting.
  it("keeps the formatting TipTap actually produces", () => {
    const html =
      "<h2>Title</h2><p><strong>bold</strong> <em>it</em> <u>u</u></p>" +
      "<ul><li>one</li></ul><ol><li>two</li></ol>" +
      "<blockquote>quoted</blockquote><hr /><p>a<br />b</p>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("keeps tables with their colspan/rowspan and width styles", () => {
    const html =
      '<table style="min-width:50px"><colgroup><col style="min-width:25px" /></colgroup>' +
      '<tbody><tr><th colspan="2" rowspan="1">h</th><td colspan="1" rowspan="1">c</td></tr></tbody></table>';
    const out = sanitizeRichText(html);
    expect(out).toContain('colspan="2"');
    expect(out).toContain("min-width");
    expect(out).toContain("<table");
  });

  it("keeps links and adds rel=noopener to new-tab ones", () => {
    const out = sanitizeRichText(`<a href="https://x.test" target="_blank">x</a>`);
    expect(out).toContain('href="https://x.test"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("leaves a same-tab link's rel alone", () => {
    expect(sanitizeRichText(`<a href="https://x.test">x</a>`)).toBe(`<a href="https://x.test">x</a>`);
  });

  it("drops style properties outside the allowed set", () => {
    const out = sanitizeRichText(`<td style="width:10px;position:fixed;top:0">c</td>`);
    expect(out).toContain("width:10px");
    expect(out).not.toContain("position");
  });
});

describe("zRichText", () => {
  const schema = zRichText("Content is required");

  it("returns the sanitized value on success", () => {
    expect(schema.parse("<p>ok</p><script>alert(1)</script>")).toBe("<p>ok</p>");
  });

  it("rejects an empty string", () => {
    expect(schema.safeParse("").success).toBe(false);
  });

  // The case min(1) alone misses: non-empty input that is entirely markup and
  // sanitizes down to nothing.
  it("rejects input that sanitizes to nothing", () => {
    expect(schema.safeParse("<script>alert(1)</script>").success).toBe(false);
  });
});
