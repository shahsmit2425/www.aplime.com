import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
// Isolated synthetic canaries, never real credentials. Run in a separate process.
const secret = "SERVICETONES_PRIVATE_ENV_CANARY_97c063";
for (const key of [
  "DATABASE_URL",
  "FIREBASE_PRIVATE_KEY",
  "STRIPE_SECRET_KEY",
  "VITE_PRIVATE_CANARY",
])
  process.env[key] = secret;
process.env.API_URL = "https://public-api.example.invalid";
process.env.APP_ENV = "development";
const { build, resolveConfig } = await import("vite");
async function scan(dir) {
  let contents = "";
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, f.name);
    if (f.isDirectory()) contents += await scan(file);
    else if (/\.(js|html|json|css)$/.test(f.name))
      contents += await readFile(file, "utf8");
  }
  return contents;
}
for (const [configFile, outDir] of [
  ["vite.config.ts", "dist/privacy-check/customer"],
  ["apps/admin/vite.config.ts", "../../dist/privacy-check/admin"],
]) {
  const config = await resolveConfig(
    { configFile, logLevel: "silent" },
    "build",
  );
  assert.equal(
    config.env.VITE_PRIVATE_CANARY,
    undefined,
    "Automatic public env exposure must stay disabled",
  );
  await build({
    configFile,
    logLevel: "silent",
    build: { outDir, emptyOutDir: true },
  });
  const output = await scan(path.resolve(config.root, outDir));
  assert.ok(
    !output.includes(secret),
    "Private environment value appeared in browser output",
  );
  if (configFile.includes("admin"))
    assert.ok(
      output.includes(process.env.API_URL),
      "Admin must receive the explicitly public API URL",
    );
}
console.log(
  "Both browser builds exclude private environment canaries; admin public API configuration is included.",
);
