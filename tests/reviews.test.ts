import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pool } from "../src/server/db/index.js";
import { publicReviews, submitReviewReply } from "../src/server/reviews.js";
import { reviewInput, reviewerDisplayName } from "../src/shared/reviews.js";
const db = new PGlite();
await db.exec(`CREATE TABLE projects(id text PRIMARY KEY,category text,status text,pro_id text,customer_id text,address text,town text NOT NULL DEFAULT '',region text NOT NULL DEFAULT '');
CREATE TABLE reviews(id text,project_id text,pro_id text,rating int,body text,reply text,created_at timestamptz,reviewer_name text,replied_at timestamptz); CREATE TABLE review_images(project_id text,slot int,object_key text);`);
pool.query = (async (sql: string, values?: unknown[]) =>
  db.query(sql, values)) as typeof pool.query;
test.after(async () => {
  await db.close();
  await pool.end();
});
test("review inputs require an intentional valid rating and nonblank bounded text", () => {
  for (const rating of [undefined, 0, 6, 2.5, "5"])
    assert.equal(
      reviewInput.safeParse({ rating, body: "Detailed feedback" }).success,
      false,
    );
  assert.equal(
    reviewInput.safeParse({ rating: 1, body: "   " }).success,
    false,
  );
  assert.equal(
    reviewInput.safeParse({ rating: 5, body: "x".repeat(2001) }).success,
    false,
  );
  assert.equal(
    reviewInput.safeParse({
      rating: 5,
      body: "Detailed feedback",
      proId: "forged",
    }).success,
    false,
  );
  assert.equal(
    reviewInput.parse({ rating: 1, body: "  Honest negative feedback  " }).body,
    "Honest negative feedback",
  );
});
test("public reviews preserve negative feedback, paginate deterministically and omit private information", async () => {
  await db.query(
    "INSERT INTO projects VALUES ('project','Cleaning','completed','pro','customer-private','Secret street','Hoboken','NJ')",
  );
  for (let i = 0; i < 12; i++)
    await db.query(
      "INSERT INTO reviews VALUES ($1,'project','pro',$2,$3,NULL,'2026-01-01',NULL,NULL)",
      [String(i).padStart(2, "0"), (i % 5) + 1, `Feedback ${i}`],
    );
  const first = await publicReviews("pro", 0),
    second = await publicReviews("pro", first.nextOffset!);
  assert.equal(first.total, 12);
  assert.equal(first.reviews.length, 10);
  assert.equal(first.nextOffset, 10);
  assert.equal(second.reviews.length, 2);
  assert.equal(second.nextOffset, null);
  assert.equal(
    new Set([...first.reviews, ...second.reviews].map((r) => r.id)).size,
    12,
  );
  assert.deepEqual(first.distribution, [3, 3, 2, 2, 2]);
  assert.equal(first.average, 33 / 12);
  assert.ok(first.reviews.some((r) => r.rating === 1));
  assert.ok(first.reviews.every((r) => r.completedProject));
  assert.ok(first.reviews.every((r) => r.reviewer === null && r.town === null));
  for (const row of first.reviews)
    assert.deepEqual(
      Object.keys(row).sort(),
      [
        "id",
        "rating",
        "body",
        "reply",
        "repliedAt",
        "createdAt",
        "reviewer",
        "town",
        "category",
        "completedProject",
        "photos",
      ].sort(),
    );
  const empty = await publicReviews("other", 0);
  assert.equal(empty.total, 0);
  assert.equal(empty.average, 0);
  assert.equal(empty.nextOffset, null);
  await db.query("UPDATE projects SET status='disputed' WHERE id='project'");
  assert.ok(
    (await publicReviews("pro", 0)).reviews.every((r) => !r.completedProject),
  );
});

test("a name and town are public only on reviews whose customer chose to sign them", async () => {
  await db.query(
    "INSERT INTO projects(id,category,status,pro_id,customer_id,address,town,region) VALUES ('signed-job','Painting','completed','signed-pro','signed-customer','12 Private Road','Hoboken','NJ'),('unsigned-job','Painting','completed','signed-pro','signed-customer','12 Private Road','Hoboken','NJ'),('townless-job','Painting','completed','signed-pro','signed-customer','12 Private Road','','')",
  );
  await db.query(
    "INSERT INTO reviews VALUES ('signed','signed-job','signed-pro',5,'Signed','Thanks','2026-03-03','Maria S.','2026-03-04'),('unsigned','unsigned-job','signed-pro',2,'Unsigned',NULL,'2026-03-02',NULL,NULL),('townless','townless-job','signed-pro',4,'Townless',NULL,'2026-03-01','Lee',NULL)",
  );
  const page = await publicReviews("signed-pro", 0);
  const by = Object.fromEntries(page.reviews.map((r) => [r.id, r]));
  assert.equal(by.signed.reviewer, "Maria S.");
  assert.equal(by.signed.town, "Hoboken, NJ");
  assert.ok(by.signed.repliedAt);
  assert.equal(by.unsigned.reviewer, null);
  assert.equal(by.unsigned.town, null);
  assert.equal(by.unsigned.repliedAt, null);
  assert.equal(by.townless.reviewer, "Lee");
  assert.equal(by.townless.town, null);
  assert.ok(!JSON.stringify(page).includes("Private Road"));
  assert.ok(!JSON.stringify(page).includes("signed-customer"));
});

test("reviews sort by date or rating without changing the summary", async () => {
  const ids = async (sort?: "newest" | "highest" | "lowest") =>
    (await publicReviews("signed-pro", 0, sort)).reviews.map((r) => r.id);
  assert.deepEqual(await ids(), ["signed", "unsigned", "townless"]);
  assert.deepEqual(await ids("newest"), ["signed", "unsigned", "townless"]);
  assert.deepEqual(await ids("highest"), ["signed", "townless", "unsigned"]);
  assert.deepEqual(await ids("lowest"), ["unsigned", "townless", "signed"]);
  const lowest = await publicReviews("signed-pro", 0, "lowest");
  assert.equal(lowest.total, 3);
  assert.deepEqual(lowest.distribution, [0, 1, 0, 1, 1]);
});

test("a published reviewer name is a first name and last initial, never contact details", () => {
  assert.equal(reviewerDisplayName("maria lopez sanchez"), "Maria S.");
  assert.equal(reviewerDisplayName("  Lee  "), "Lee");
  assert.equal(reviewerDisplayName("Anne-Marie O’Neil"), "Anne-Marie O.");
  assert.equal(reviewerDisplayName("Sam 2"), "Sam");
  for (const name of ["", "   ", "sam@example.com", "5551234567", "@sam"])
    assert.equal(reviewerDisplayName(name), null);
  assert.ok(reviewerDisplayName("x".repeat(200) + " Smith")!.length <= 40);
});

test("the review form accepts an optional signature choice and nothing else", () => {
  assert.equal(
    reviewInput.parse({ rating: 4, body: "Good", showName: true }).showName,
    true,
  );
  assert.equal(
    reviewInput.parse({ rating: 4, body: "Good" }).showName,
    undefined,
  );
  for (const forged of [
    { showName: "yes" },
    { reviewerName: "Somebody Else" },
    { reviewer: "Somebody Else" },
  ])
    assert.equal(
      reviewInput.safeParse({ rating: 4, body: "Good", ...forged }).success,
      false,
    );
});

test("short review text is accepted without a minimum character count", () => {
  assert.equal(reviewInput.safeParse({ rating: 5, body: "OK" }).success, true);
});

test("only the reviewed professional can reply, and a published reply cannot be replaced", async () => {
  await db.query(
    "INSERT INTO reviews VALUES ('reply-test','job','owner',5,'Good',NULL,now(),NULL,NULL)",
  );
  await assert.rejects(() =>
    submitReviewReply(pool, "reply-test", "other", "Forged"),
  );
  assert.equal(
    await submitReviewReply(pool, "reply-test", "owner", "Thank you"),
    "job",
  );
  await assert.rejects(() =>
    submitReviewReply(pool, "reply-test", "owner", "Replacement"),
  );
  assert.equal(
    (
      await db.query<{ reply: string }>(
        "SELECT reply FROM reviews WHERE id='reply-test'",
      )
    ).rows[0].reply,
    "Thank you",
  );
  assert.ok(
    (
      await db.query<{ replied_at: Date | null }>(
        "SELECT replied_at FROM reviews WHERE id='reply-test'",
      )
    ).rows[0].replied_at,
  );
});
