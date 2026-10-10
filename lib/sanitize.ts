import sanitizeHtml from "sanitize-html";
import { z } from "zod";

/**
 * Sanitizer for the two rich-text fields the storefront renders with
 * `dangerouslySetInnerHTML`: `posts.content` and `products.description`.
 *
 * Both are authored in the TipTap editor (components/tiptap-editor.tsx,
 * StarterKit + TableKit) and were stored and rendered exactly as received.
 * The editor constrains what an author can *type*, but it runs in the
 * browser — the server accepted `content: z.string()` and wrote it verbatim,
 * so anything that could POST to the route could store arbitrary HTML.
 *
 * That is a privilege-escalation path rather than a public XSS: writing
 * either field needs `blog:write` or `products:write`. But those are granular
 * roles handed to staff who are not admins, and the payload executes in the
 * browser of whoever views the page — including an admin on the dashboard
 * preview. The session cookie is httpOnly, so a script cannot read the token,
 * but it is same-origin and can call `/api/*` as the victim.
 *
 * The allowlist below is TipTap's own output, checked against every row in
 * production first: p, br, strong, em, u, h1–h4, blockquote, ul/ol/li, a,
 * hr, and the full table set. Nothing stored today is removed by it.
 */

// `style` is allowed only on table elements, and only for the width
// properties TipTap's resizable tables emit — never as a general attribute.
const TABLE_TAGS = ["table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col"];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "span", "div",
    "strong", "b", "em", "i", "u", "s", "strike", "sub", "sup", "mark",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code",
    "a", "img",
    ...TABLE_TAGS,
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    th: ["colspan", "rowspan", "scope", "style"],
    td: ["colspan", "rowspan", "style"],
    table: ["style"],
    col: ["style", "span"],
    colgroup: ["span"],
  },
  // Anything not listed here is dropped, so `javascript:` and `data:` URIs
  // can never reach an href or src.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowedStyles: {
    "*": {
      width: [/^\d+(?:\.\d+)?(?:px|%|em|rem)$/],
      "min-width": [/^\d+(?:\.\d+)?(?:px|%|em|rem)$/],
      "text-align": [/^(?:left|right|center|justify)$/],
    },
  },
  // A link that opens a new tab without rel="noopener" hands the opened page
  // a reference back to ours via window.opener.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.target
        ? { ...attribs, rel: "noopener noreferrer" }
        : attribs,
    }),
  },
  // Drop the contents of a removed tag rather than leaving its text inline —
  // without this, stripping `<script>alert(1)</script>` would render the
  // `alert(1)` as visible body copy.
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
};

/** Strip anything the rich-text editor could not legitimately have produced. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/**
 * A required rich-text field, sanitized as part of validation — so a handler
 * cannot forget to call the sanitizer, and every read of the validated value
 * is already clean. The second length check catches input that was entirely
 * markup: `<script>…</script>` passes `min(1)` and sanitizes to "".
 */
export function zRichText(message: string) {
  return z
    .string()
    .min(1, message)
    .transform(sanitizeRichText)
    .refine((value) => value.trim().length > 0, message);
}
