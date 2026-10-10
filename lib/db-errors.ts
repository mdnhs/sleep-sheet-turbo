/**
 * True when an error is a Postgres unique-constraint violation (SQLSTATE
 * 23505). Used to turn a losing concurrent insert on a unique idempotency
 * key (orders.idempotencyKey — checkout and POS both use it) into "return
 * the row the winning request already created" instead of a 500.
 */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return (
    e?.code === "23505" ||
    e?.cause?.code === "23505" ||
    /duplicate key|unique constraint/i.test(e?.message ?? "")
  );
}
