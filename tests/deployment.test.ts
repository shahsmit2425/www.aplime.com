import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import { spawnSync } from "node:child_process";
import mapping from "../config/environments.json";
test("three branches map to isolated environments and mobile application identifiers", () => {
  assert.deepEqual(Object.keys(mapping), ["development", "stagging", "main"]);
  assert.equal(new Set(Object.values(mapping).map((x) => x.appId)).size, 3);
});
test("Render services cannot auto-deploy another environment", () => {
  const b = parse(readFileSync("render.yaml", "utf8"));
  assert.equal(b.services.length, 12);
  assert.equal(b.databases.length, 3);
  assert.equal(b.envVarGroups.length, 6);
  for (const group of b.envVarGroups.filter((g: any) =>
    g.name.endsWith("-common"),
  )) {
    assert.ok(
      group.envVars.every((v: any) =>
        ["NODE_ENV", "NODE_VERSION", "APP_ENV", "SITE_URL", "API_URL"].includes(
          v.key,
        ),
      ),
    );
  }
  for (const s of b.services) {
    assert.equal(s.autoDeployTrigger, "off");
    const target = mapping[s.branch as keyof typeof mapping];
    assert.ok(target);
    assert.ok(s.name.includes(target.environment));
    assert.deepEqual(s.envVars, [
      { fromGroup: "servicetones-" + target.environment + "-common" },
      ...(s.name.endsWith("-api") || s.name.endsWith("-mail")
        ? [{ fromGroup: "servicetones-" + target.environment + "-backend" }]
        : []),
    ]);
  }
});
test("admin static headers permit private signed R2 image previews without opening frames or object embeds", () => {
  const blueprint = parse(readFileSync("render.yaml", "utf8"));
  const admins = blueprint.services.filter((s: any) =>
    s.name.endsWith("-admin"),
  );
  assert.equal(admins.length, 3);
  for (const service of admins) {
    const csp = service.headers.find(
      (h: any) => h.name === "Content-Security-Policy",
    ).value;
    assert.match(
      csp,
      /img-src 'self' data: https:\/\/\*\.r2\.cloudflarestorage\.com;/,
    );
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.ok(
      service.headers.some(
        (h: any) => h.name === "Referrer-Policy" && h.value === "no-referrer",
      ),
    );
  }
});
test("promotion guard rejects direct development-to-main changes", () => {
  const r = spawnSync(process.execPath, ["scripts/ci-target.mjs"], {
    env: {
      ...process.env,
      EVENT_NAME: "pull_request",
      HEAD_BRANCH: "development",
      BASE_BRANCH: "main",
    },
    encoding: "utf8",
  });
  assert.notEqual(r.status, 0);
  const valid = spawnSync(process.execPath, ["scripts/ci-target.mjs"], {
    env: {
      ...process.env,
      EVENT_NAME: "pull_request",
      HEAD_BRANCH: "stagging",
      BASE_BRANCH: "main",
    },
    encoding: "utf8",
  });
  assert.equal(valid.status, 0);
});
test("release deployment depends on validation, and mobile depends on matching web release", () => {
  const w = parse(readFileSync(".github/workflows/release.yml", "utf8"));
  assert.equal(w.jobs.web.needs, "validate");
  assert.deepEqual(w.jobs.ios.needs, ["validate", "web"]);
  assert.deepEqual(w.jobs.android.needs, ["validate", "web"]);
  assert.equal(w.permissions.contents, "read");
  for (const platform of ["ios", "android"]) {
    assert.match(
      w.jobs[platform].if,
      /needs\.web\.outputs\.mobile-enabled == 'true'/,
    );
  }
  assert.equal(
    w.jobs.web.outputs["mobile-enabled"],
    "${{ steps.mobile.outputs.enabled }}",
  );
  const deployEnv = w.jobs.web.steps.find(
    (step: any) =>
      step.name === "Deploy exact validated commit and verify health",
  ).env;
  assert.match(deployEnv.DEPLOY_API, /BACKEND_RELEASES_ENABLED == 'true'/);
  assert.match(deployEnv.DEPLOY_WORKER, /BACKEND_RELEASES_ENABLED == 'true'/);
});
