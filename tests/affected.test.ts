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
  for (const path of [
    "src/shared/chat-ui.tsx",
    "src/shared/chat.css",
    "src/shared/typography.css",
  ])
    assert.deepEqual(affected([path]), {
      admin: true,
      web: true,
      mobile: true,
      api: false,
      worker: false,
    });
});

test("marketplace design styles deploy only the web and shared mobile clients", () => {
  assert.deepEqual(
    affected(["src/design-system.css", "src/client/marketplace-cards.tsx"]),
    {
      admin: false,
      web: true,
      api: false,
      worker: false,
      mobile: true,
    },
  );
});

test("call meeting contract is shared by marketplace clients and API, while its migration also updates the worker", () => {
  assert.deepEqual(affected(["src/shared/meetings.ts"]), {
    admin: false,
    web: true,
    api: true,
    worker: false,
    mobile: true,
  });
  assert.deepEqual(
    affected([
      "src/shared/meetings.ts",
      "src/server/db/migrations/013_scheduled_calls.sql",
    ]),
    {
      admin: false,
      web: true,
      api: true,
      worker: true,
      mobile: true,
    },
  );
});

test("meeting expiry and cleanup dependencies deploy both API and worker", () => {
  for (const path of [
    "scripts/check-email.ts",
    "src/server/integrations/email.ts",
    "src/server/meeting-lifecycle.ts",
    "src/server/account-cleanup.ts",
    "src/server/email-alerts.ts",
    "src/server/email-template.ts",
    "src/server/email-reminders.ts",
    "src/server/project-events.ts",
    "src/server/matching.ts",
    "src/server/outbox.ts",
    "src/server/job-worker.ts",
    "src/server/job-queue.ts",
    "src/server/legacy-worker.ts",
    "src/server/redis.ts",
    "src/server/business-publication.ts",
    "src/server/integrations/firebase.ts",
    "src/server/integrations/storage.ts",
    "src/server/integrations/storage-error.ts",
  ])
    assert.deepEqual(affected([path]), {
      web: false,
      admin: false,
      api: true,
      worker: true,
      mobile: false,
    });
});
