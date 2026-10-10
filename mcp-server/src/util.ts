/** Every tool returns its result as pretty-printed JSON text — MCP's
 * content blocks are text/image/resource, so a structured JSON object is
 * serialized rather than typed. */
export function text(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}
