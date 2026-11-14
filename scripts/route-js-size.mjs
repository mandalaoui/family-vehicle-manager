// Prints the client JS (raw and gzip) that each route references in its client reference manifest.
// This is the JS a page can load (the union of chunks of its client components, layouts included).
// Rough, build-output based measure for before/after comparisons; not a real-user metric.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const appDir = ".next/server/app";
const routes = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith("page_client-reference-manifest.js")) routes.push(p);
  }
})(appDir);

const sizeOf = (chunk) => {
  const file = join(".next", chunk.replace(/^\/_next\//, ""));
  if (!existsSync(file)) return { raw: 0, gz: 0 };
  const buf = readFileSync(file);
  return { raw: buf.length, gz: gzipSync(buf).length };
};

const rows = [];
for (const file of routes) {
  const src = readFileSync(file, "utf8");
  const chunks = new Set();
  for (const m of src.matchAll(/"chunks":\[([^\]]*)\]/g)) {
    for (const c of m[1].matchAll(/"(\/_next\/static\/[^"]+\.js)"/g)) chunks.add(c[1]);
  }
  let raw = 0;
  let gz = 0;
  for (const c of chunks) {
    const s = sizeOf(c);
    raw += s.raw;
    gz += s.gz;
  }
  const route = file.replace(appDir, "").replace("/page_client-reference-manifest.js", "") || "/";
  rows.push({ route, chunks: chunks.size, rawKB: Math.round(raw / 1024), gzKB: Math.round(gz / 1024) });
}
rows.sort((a, b) => a.route.localeCompare(b.route));
console.table(rows);
