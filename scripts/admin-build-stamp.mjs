import { writeFileSync } from "node:fs";
const environment = process.env.APP_ENV;
const api = process.env.API_URL;
if (
  process.env.RENDER === "true" &&
  (!["development", "stagging", "production"].includes(environment) ||
    !api?.startsWith("https://"))
)
  throw new Error(
    "Set APP_ENV and HTTPS API_URL in the shared environment group.",
  );
writeFileSync(
  "dist/admin/release.json",
  JSON.stringify({
    environment: environment || "development",
    release: process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || "local",
  }),
);
