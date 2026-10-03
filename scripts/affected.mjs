import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
export function affected(paths) {
  const result = {
    web: false,
    admin: false,
    api: false,
    worker: false,
    mobile: false,
  };
  const all = () => Object.keys(result).forEach((k) => (result[k] = true));
  for (const file of paths) {
    if (/^(docs\/|README\.md$|AGENTS\.md$|tests\/|\.gitignore$)/.test(file))
      continue;
    if (file.startsWith("apps/admin/")) {
      result.admin = true;
      continue;
    }
    if (file.startsWith("apps/web/")) {
      result.web = true;
      continue;
    }
    if (file === "src/shared/seo-content.ts") {
      result.web = true;
      continue;
    }
    if (file.startsWith("src/shared/")) {
      all();
      continue;
    }
    if (
      /^(src\/client\/|src\/entry-client|src\/styles|public\/|index\.html|vite\.config)/.test(
        file,
      )
    ) {
      result.web = result.mobile = true;
      continue;
    }
    if (/^(src\/public-page|src\/entry-server)/.test(file)) {
      result.web = true;
      continue;
    }
    if (/^(src\/server\/|apps\/api\/)/.test(file)) {
      result.api = true;
      if (
        /(\/db\/|\/config\.|\/repository\.|\/worker\.|\/integrations\/email\.|\/errors\.)/.test(
          file,
        )
      )
        result.worker = true;
      continue;
    }
    if (
      /^(android\/|ios\/|fastlane\/|capacitor\.config|scripts\/prepare-mobile)/.test(
        file,
      )
    ) {
      result.mobile = true;
      continue;
    }
    // Shared dependencies, build tooling and infrastructure must fan out safely.
    all();
  }
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let paths;
  if (
    process.env.EVENT_NAME === "workflow_dispatch" ||
    !process.env.BEFORE_SHA ||
    /^0+$/.test(process.env.BEFORE_SHA)
  )
    paths = ["package.json"];
  else
    paths = execFileSync(
      "git",
      ["diff", "--name-only", process.env.BEFORE_SHA, process.env.GITHUB_SHA],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean);
  const selected = affected(paths);
  console.log("Affected applications:", selected);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(selected)
        .map(([k, v]) => `${k}=${v}\n`)
        .join(""),
    );
}
