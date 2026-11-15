// Runs the SQL test-suite on an in-process Postgres (PGlite): auth/storage stubs, every migration in
// order, then supabase/tests/rls_tests.sql. Local/CI only: never run the stubs on Supabase.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("../supabase/", import.meta.url);
const path = (...p) => join(root.pathname.replace(/^\/([A-Za-z]:)/, "$1"), ...p);

// PGlite runs a whole script in ONE transaction, so now() never advances between statements and the
// "updated_at trigger" check cannot pass here. It passes on a real Postgres (psql, one statement at a time).
const KNOWN_ENVIRONMENT_FAILURES = new Set(["updated_at trigger"]);

const migrations = readdirSync(path("migrations")).filter((f) => f.endsWith(".sql")).sort();
const files = [path("tests", "stubs.sql"), ...migrations.map((f) => path("migrations", f)), path("tests", "rls_tests.sql")];

const db = new PGlite();
let last;
for (const file of files) {
  const sql = readFileSync(file, "utf8")
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((l) => !l.startsWith("\\set"))
    .join("\n");
  try {
    last = await db.exec(sql);
  } catch (e) {
    console.error(`ERROR in ${file}: ${String(e.message).slice(0, 400)}`);
    process.exit(2);
  }
}

const rows = last[last.length - 1].rows;
let failures = 0;
let skipped = 0;
for (const r of rows) {
  if (r.r === "PASS") continue;
  if (KNOWN_ENVIRONMENT_FAILURES.has(r.name)) {
    skipped++;
    continue;
  }
  failures++;
  console.error(`FAIL #${r.n} ${r.name} | got: ${r.got} | want: ${r.want}`);
}
console.log(`${rows.length - failures - skipped}/${rows.length} PASS (${migrations.length} migrations${skipped ? `, ${skipped} known PGlite-only skip` : ""})`);
process.exit(failures ? 1 : 0);
