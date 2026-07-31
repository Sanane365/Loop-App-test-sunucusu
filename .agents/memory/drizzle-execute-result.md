---
name: Drizzle db.execute() result format
description: How to correctly handle raw SQL query results from drizzle-orm/node-postgres
---

With `drizzle-orm/node-postgres` (pg adapter), `db.execute(sql`...`)` returns a pg `QueryResult` object — NOT an array.

**Why:** The pg driver wraps results in QueryResult which has `.rows`, `.rowCount`, `.fields`, etc. Drizzle does not unwrap it for raw `db.execute()` calls.

**Symptoms:**
- `rows.map is not a function` — trying to call array methods on the QueryResult object
- `(intermediate value) is not iterable` — trying to spread `[...await db.execute(...)]`
- `const [first] = await db.execute(...)` — WORKS because JavaScript destructuring falls back gracefully

**How to apply:**
Use this helper pattern for any multi-row raw SQL query:
```ts
const execRows = async (q: ReturnType<typeof db.execute>): Promise<any[]> => {
  const r = await q as any;
  return Array.isArray(r) ? r : (r?.rows ?? []);
};
const rows = await execRows(db.execute(sql`SELECT ...`));
```

For single-row: `const [row] = await execRows(db.execute(sql`SELECT ...`))` is safe.
For mutations (INSERT/UPDATE/DELETE): no result needed, just `await db.execute(...)`.
