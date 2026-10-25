import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pool } from "../src/server/db/index.js";
import { publicReviews } from "../src/server/reviews.js";
import { reviewInput } from "../src/shared/reviews.js";
const db = new PGlite();
await db.exec(`CREATE TABLE projects(id text PRIMARY KEY,category text,status text,pro_id text,customer_id text,address text);
CREATE TABLE reviews(id text,project_id text,pro_id text,rating int,body text,reply text,created_at timestamptz); CREATE TABLE review_images(project_id text,slot int,object_key text);`);
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
    "INSERT INTO projects VALUES ('project','Cleaning','completed','pro','customer-private','Secret street')",
  );
  for (let i = 0; i < 12; i++)
    await db.query(
      "INSERT INTO reviews VALUES ($1,'project','pro',$2,$3,NULL,'2026-01-01')",
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
  for (const row of first.reviews)
    assert.deepEqual(
      Object.keys(row).sort(),
      [
        "id",
        "rating",
        "body",
        "reply",
        "createdAt",
        "category",
        "completedProject",
        "photos",
      ].sort(),
    );
  const empty = await publicReviews("other", 0);
  assert.equal(empty.total, 0);
  assert.equal(empty.average, 0);
  assert.equal(empty.nextOffset, null);
  await db.query("UPDATE projects SET status='disputed'");
  assert.ok(
    (await publicReviews("pro", 0)).reviews.every((r) => !r.completedProject),
  );
});

test("short review text is accepted without a minimum character count",()=>{
 assert.equal(reviewInput.safeParse({rating:5,body:"OK"}).success,true);
});
