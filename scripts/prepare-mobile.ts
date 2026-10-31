import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import mapping from "../config/environments.json";
import type { PublicConfig } from "../src/shared/config.js";
const branch =
  process.env.GITHUB_REF_NAME ||
  execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  }).trim();
const target = mapping[branch as keyof typeof mapping];
if (!target)
  throw new Error("Mobile builds require a mapped deployment branch.");
if (process.env.APP_ENV && process.env.APP_ENV !== target.environment)
  throw new Error("APP_ENV must match the selected deployment branch.");
const site = process.env.API_URL;
if (!site || !site.startsWith("https://"))
  throw new Error("Set API_URL to the deployed HTTPS API environment.");
const r = await fetch(site.replace(/\/$/, "") + "/api/config", {
  signal: AbortSignal.timeout(20000),
});
if (!r.ok)
  throw new Error("Could not fetch public configuration from the API.");
const config = (await r.json()) as PublicConfig;
if (config.environment !== target.environment)
  throw new Error("Mobile environment mismatch.");
// Independently deployed API may be an earlier compatible release.
config.release = process.env.GITHUB_SHA || config.release;
config.apiUrl = site.replace(/\/$/, "");
const index = await readFile("dist/client/index.html", "utf8");
await writeFile(
  "dist/client/index.html",
  index
    .replace(
      "<!--bootstrap-->",
      "<script>window.__CONFIG__=" +
        JSON.stringify(config).replace(/</g, "\\u003c") +
        ";</script>",
    )
    .replace(
      "<!--head-->",
      "<title>" +
        target.appName +
        '</title><meta name="robots" content="noindex,nofollow"/>',
    ),
);
const firebaseAndroid = process.env.GOOGLE_SERVICES_JSON_BASE64,
  firebaseIos = process.env.GOOGLE_SERVICE_INFO_PLIST_BASE64;
if (firebaseAndroid) {
  const decoded = Buffer.from(firebaseAndroid, "base64");
  const cfg = JSON.parse(decoded.toString());
  if (
    cfg.project_info?.project_id !== config.firebase.projectId ||
    !cfg.client?.some(
      (c: any) =>
        c.client_info?.android_client_info?.package_name === target.appId,
    )
  )
    throw new Error(
      "Android Firebase configuration targets the wrong environment.",
    );
  await writeFile("android/app/google-services.json", decoded);
}
if (firebaseIos) {
  const decoded = Buffer.from(firebaseIos, "base64").toString();
  if (
    !decoded.includes("<string>" + target.iosAppId + "</string>") ||
    !decoded.includes("<string>" + config.firebase.projectId + "</string>")
  )
    throw new Error(
      "iOS Firebase configuration targets the wrong environment.",
    );
  await writeFile("ios/App/App/GoogleService-Info.plist", decoded);
}
const projectPath = "ios/App/App.xcodeproj/project.pbxproj";
let project = await readFile(projectPath, "utf8");
project = project
  .replace(
    /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
    "PRODUCT_BUNDLE_IDENTIFIER = " + target.iosAppId + ";",
  )
  .replace(
    /CURRENT_PROJECT_VERSION = [^;]+;/g,
    "CURRENT_PROJECT_VERSION = " + (process.env.BUILD_NUMBER || "1") + ";",
  );
await writeFile(projectPath, project);
let plist = await readFile("ios/App/App/Info.plist", "utf8");
plist = plist.replace(
  /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
  "$1" + target.appName + "$2",
);
if (firebaseIos) {
  const decoded = Buffer.from(firebaseIos, "base64").toString();
  const reversed = decoded.match(
    /<key>REVERSED_CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/,
  )?.[1];
  if (!reversed)
    throw new Error(
      "Google sign-in requires REVERSED_CLIENT_ID in the iOS Firebase configuration.",
    );
  const urlTypes =
    "<key>CFBundleURLTypes</key><array><dict><key>CFBundleURLSchemes</key><array><string>" +
    reversed +
    "</string></array></dict></array>";
  plist = plist
    .replace(/<!--google-url-start-->[\s\S]*?<!--google-url-end-->/, "")
    .replace(
      /<\/dict>\s*<\/plist>/,
      "<!--google-url-start-->" +
        urlTypes +
        "<!--google-url-end--></dict></plist>",
    );
}
await writeFile("ios/App/App/Info.plist", plist);
console.log(
  "Prepared " +
    target.appName +
    " using public configuration from " +
    site +
    ".",
);
