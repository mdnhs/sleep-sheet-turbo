# Sleep Sheet MCP Server

Lets Claude Code manage this store directly — write and publish blog posts,
update product price/stock/description, and check or update orders — by
calling the site's own API.

## What it can do

- **Blog**: list, get, create, update, publish/unpublish
- **Products**: list, get, update price/stock/description/discount/featured
- **Orders**: list, get, update status, cancel

Deliberately **not** included: creating or deleting products, deleting
orders, refunds, and anything else with a large or irreversible blast
radius. Those stay dashboard-only. See `src/tools/*.ts` if you want to add
more.

## Setup

### 1. Create an API key on the site

Log in as an admin, go to **Dashboard → Settings → API Keys → New Key**,
name it something like "Claude Code MCP", and copy the key it shows you —
it's only shown once.

### 2. Install and build

```bash
cd mcp-server
npm install
npm run build
```

### 3. Configure Claude Code

Add this to your Claude Code MCP config (project-level `.mcp.json`, or via
`claude mcp add`):

```json
{
  "mcpServers": {
    "sleep-sheet": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "WEBSITE_API_URL": "http://localhost:3000/api",
        "WEBSITE_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

Point `WEBSITE_API_URL` at your production URL (e.g.
`https://yourstore.com/api`) once you're done testing locally — the key
works the same way in both.

### 4. Verify

Restart Claude Code and ask it something like "list my blog posts" or "what's
the stock on [product]?" — it should call the `sleep-sheet` MCP tools.

## Notes

- A key acts **as the admin who created it** — same role, same permissions.
  Revoking it (or the user's account) cuts off access immediately.
- Only the key's SHA-256 hash is stored server-side; if you lose the raw
  key, revoke it from the dashboard and issue a new one.
- Run `npm run dev` (uses `tsx`, no build step) while iterating on tools
  locally, then `npm run build` before pointing Claude Code at `dist/`.
