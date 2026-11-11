import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { PgBoss } from "pg-boss";
import { jobQueues, jobQueueOptions } from "../src/server/job-queue.js";

test("durable queues retain schedules and pending jobs across worker restart, and retry without concurrent duplicates", async () => {
  const db = new PGlite();
  const create = () =>
    new PgBoss({
      backend: "pglite",
      db: {
        executeSql: async (sql, values) =>
          values?.length
            ? db.query(sql, values)
            : { rows: (await db.exec(sql)).flatMap((part) => part.rows) },
      },
      supervise: false,
      schedule: false,
    });
  let boss = create();
  try {
    await boss.start();
    for (const name of jobQueues) {
      await boss.createQueue(name, jobQueueOptions);
      await boss.schedule(name, "* * * * *", {}, { singletonKey: name });
    }
    const name = "email-delivery";
    const id = await boss.send(name, {}, { singletonKey: name });
    assert.ok(id);
    assert.equal(await boss.send(name, {}, { singletonKey: name }), null);
    await boss.stop();
    boss = create();
    await boss.start();
    assert.equal((await boss.getSchedules()).length, jobQueues.length);
    const [job] = await boss.fetch(name, { includeMetadata: true });
    assert.equal(job.id, id);
    assert.equal((await boss.fetch(name)).length, 0);
    assert.equal(await boss.send(name, {}, { singletonKey: name }), null);
    await boss.fail(name, job, { message: "Transient failure" });
    const [retried] = await boss.findJobs(name, { id: id! });
    assert.equal(retried.state, "retry");
    assert.equal(await boss.send(name, {}, { singletonKey: name }), null);
    await db.query(
      "UPDATE pgboss.job SET start_after=now()-interval '1 second' WHERE id=$1",
      [id],
    );
    const [attempt] = await boss.fetch(name, { includeMetadata: true });
    assert.equal(attempt.id, id);
    assert.equal(attempt.retryCount, 1);
    await boss.complete(name, attempt);
    assert.ok(await boss.send(name, {}, { singletonKey: name }));
  } finally {
    await boss.stop();
    await db.close();
  }
});
