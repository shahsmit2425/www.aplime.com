import test from "node:test";
import assert from "node:assert/strict";
import { renderPage } from "../src/entry-server.js";
import { fallbackConfig } from "../src/shared/config.js";
test("public service routes contain useful server rendered content and production SEO metadata", () => {
  const page = renderPage("/services/plumbing", {
    ...fallbackConfig,
    environment: "production",
    siteUrl: "https://aplime.com",
  });
  assert.equal(page.status, 200);
  assert.match(page.html, /Plumbing services/);
  assert.match(page.head, /index,follow/);
  assert.match(page.head, /https:\/\/aplime.com\/services\/plumbing/);
  assert.match(page.head, /Plumbing services \| Aplime/);
  assert.match(page.head, /application\/ld\+json/);
});
test("staging and private routes are never indexable", () => {
  assert.match(
    renderPage("/", { ...fallbackConfig, environment: "stagging" }).head,
    /noindex,nofollow/,
  );
  assert.match(
    renderPage("/app/projects", {
      ...fallbackConfig,
      environment: "production",
    }).head,
    /noindex,nofollow/,
  );
  assert.equal(renderPage("/not-a-real-page", fallbackConfig).status, 404);
});
test("bootstrap JSON cannot break out of a script tag", () => {
  const page = renderPage("/", {
    ...fallbackConfig,
    supportEmail: "</script><script>alert(1)</script>",
  });
  assert.ok(!page.bootstrap.includes("</script><script>"));
  assert.match(page.bootstrap, /\\u003c/);
});
