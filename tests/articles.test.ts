import test from "node:test";
import assert from "node:assert/strict";
import { renderPage } from "../src/entry-server.js";
import { fallbackConfig } from "../src/shared/config.js";
import { homeGuides, guidePath } from "../src/shared/articles.js";
import { seoStaticPaths } from "../src/shared/seo-content.js";

test("original guides render full content, linked sections and accurate article metadata", () => {
  const titles = new Set<string>();
  for (const guide of homeGuides) {
    const path = guidePath(guide);
    const page = renderPage(path, {
      ...fallbackConfig,
      environment: "production",
      siteUrl: "https://aplime.com",
    });
    assert.equal(page.status, 200);
    assert.ok(seoStaticPaths.includes(path));
    assert.ok(!titles.has(guide.title));
    titles.add(guide.title);
    assert.match(page.head, /content="article"/);
    assert.match(page.head, /index,follow/);
    const graph = JSON.parse(
      page.head.match(/application\/ld\+json">(.*?)<\/script>/)![1],
    )["@graph"];
    assert.equal(
      graph.find((node: any) => node["@type"] === "BlogPosting").headline,
      guide.title,
    );
    for (const section of guide.sections) {
      assert.ok(page.html.includes(`id="${section.id}"`));
      assert.ok(page.html.includes(`href="#${section.id}"`));
    }
    assert.match(page.html, /Start your project/);
    assert.match(renderPage(path, fallbackConfig).head, /noindex,nofollow/);
  }
});
test("guide directory and homepage link to articles; unknown articles stay 404", () => {
  const index = renderPage("/blog", fallbackConfig);
  assert.equal(index.status, 200);
  for (const guide of homeGuides)
    assert.ok(index.html.includes(guidePath(guide)));
  assert.ok(
    renderPage("/", fallbackConfig).html.includes(guidePath(homeGuides[0])),
  );
  assert.equal(renderPage("/blog/missing", fallbackConfig).status, 404);
  assert.equal(renderPage("/blog/cleaning", fallbackConfig).status, 404);
});
