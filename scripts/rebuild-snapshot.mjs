// One-off tool used to close WORST-2 from the 2026-09-21 audit: the Drizzle
// migration snapshots in db/migrations/meta/ stopped at 0007 while 13 more
// migrations (0008-0020) were hand-written and applied without ever
// regenerating the snapshot. `drizzle-kit generate` diffs schema.ts against
// the LATEST snapshot file present, so it was silently diffing against
// 0007 — the next `db:generate` would have tried to redo everything from
// 0008 onward (duplicate tables/columns/constraints that already exist).
//
// This script produces a correct full-state snapshot for the CURRENT
// schema.ts (which already reflects every applied migration through 0020)
// using drizzle-kit's own `generateDrizzleJson`, which builds a snapshot
// directly from the schema module — no DB connection and no diffing against
// prior state, so it needs no interactive rename-resolution prompts the way
// `drizzle-kit generate` did when asked to diff across 13 unsnapshotted
// migrations at once.
//
// Kept here (not run again) as the record of how db/migrations/meta/0020_snapshot.json
// was produced — see db/migrations/README.md. Every migration since has gone
// through the normal `pnpm db:generate` flow, which is how the snapshot chain
// should always be advanced from here on.

import { generateDrizzleJson } from "drizzle-kit/api";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const schema = await import(path.join(root, "db/schema.ts"));

const prevSnapshotPath = path.join(root, "db/migrations/meta/0007_snapshot.json");
const prevSnapshot = JSON.parse(readFileSync(prevSnapshotPath, "utf-8"));

// generateDrizzleJson(schema, prevId) builds the full current-state JSON
// straight from the schema module; passing the previous snapshot's id keeps
// the id/prevId chain valid for tooling that walks it.
const json = generateDrizzleJson(schema, prevSnapshot.id);

const outPath = path.join(root, "db/migrations/meta/0020_snapshot.json");
writeFileSync(outPath, JSON.stringify(json, null, 2) + "\n");

console.log(`Wrote ${outPath}`);
console.log(`id: ${json.id}`);
console.log(`prevId: ${json.prevId}`);
