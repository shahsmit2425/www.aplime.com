import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error The deployment selector intentionally runs as plain Node ESM.
import { affected } from "../scripts/affected.mjs";
test("owner-only admin provisioning scripts are available on API without deploying clients or worker", () => {
  for (const path of [
    "scripts/admin-access.ts",
    "scripts/admin-setup.ts",
    "scripts/lib/admin-setup.ts",
  ])
    assert.deepEqual(affected([path]), {
      admin: false,
      web: false,
      api: true,
      worker: false,
      mobile: false,
    });
});
test("admin-only edits never deploy the customer app, API, worker or mobile", () => {
  assert.deepEqual(affected(["apps/admin/main.tsx", "apps/admin/styles.css"]), {
    admin: true,
    web: false,
    api: false,
    worker: false,
    mobile: false,
  });
});
test("deployment graph follows actual shared dependencies", () => {
  assert.deepEqual(affected(["src/client/pages.tsx"]), {
    admin: false,
    web: true,
    api: false,
    worker: false,
    mobile: true,
  });
  assert.deepEqual(affected(["src/server/admin-policy.ts"]), {
    admin: false,
    web: false,
    api: true,
    worker: false,
    mobile: false,
  });
  assert.deepEqual(affected(["src/server/db/migrations/002.sql"]), {
    admin: false,
    web: false,
    api: true,
    worker: true,
    mobile: false,
  });
  assert.deepEqual(affected(["docs/DEPLOYMENT.md"]), {
    admin: false,
    web: false,
    api: false,
    worker: false,
    mobile: false,
  });
  assert.deepEqual(
    affected(["src/shared/seo-content.ts", "src/public-page.tsx"]),
    {
      admin: false,
      web: true,
      api: false,
      worker: false,
      mobile: false,
    },
  );
  for (const path of [
    "src/shared/domain.ts",
    "package-lock.json",
    ".github/workflows/release.yml",
    "render.yaml",
  ])
    assert.ok(Object.values(affected([path])).every(Boolean));
});

test("shared chat presentation deploys both clients without restarting API or worker", () => {
  for (const path of ["src/shared/chat-ui.tsx", "src/shared/chat.css"])
    assert.deepEqual(affected([path]), {
      admin: true,
      web: true,
      mobile: true,
      api: false,
      worker: false,
    });
});
