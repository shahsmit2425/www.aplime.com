import { Router } from "express";
import { z } from "zod";
import { pool, transaction } from "./db/index.js";
import { fail } from "./errors.js";
import { matchSql, unblockedSql } from "./matching.js";

const dailyDistinctCustomerLimit = 10;
const eligibleContact = `FROM project_contacts c JOIN projects p ON p.id=c.project_id
 WHERE p.id=$1 AND (p.customer_id=$2 OR c.consent_at IS NOT NULL AND EXISTS(SELECT 1 FROM profiles f WHERE f.id=$2 AND NOT f.suspended AND ${unblockedSql()} AND (p.pro_id=f.id OR (p.pro_id IS NULL AND p.status IN ('requested','quoted') AND ${matchSql()}))))`;

export const projectContacts = Router();
projectContacts.get("/projects/:id/contact", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const id = z.string().uuid().parse(req.params.id);
  const {
    rows: [row],
  } = await pool.query(
    `SELECT CASE WHEN p.customer_id=$2 THEN c.phone END AS phone, c.consent_at AS "consentAt" ${eligibleContact}`,
    [id, req.account.id],
  );
  res.json(
    row?.phone
      ? row
      : row && req.query.preview === "1"
        ? { available: true }
        : null,
  );
});

projectContacts.patch("/projects/:id/contact", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const id = z.string().uuid().parse(req.params.id);
  const { sharePhone } = z
    .object({ sharePhone: z.boolean() })
    .strict()
    .parse(req.body);
  const {
    rows: [row],
  } = await pool.query(
    `UPDATE project_contacts c SET consent_at=CASE WHEN $3::boolean THEN COALESCE(c.consent_at, now()) END
     FROM projects p WHERE p.id=c.project_id AND p.customer_id=$2 AND p.id=$1
     RETURNING c.phone,c.consent_at AS "consentAt"`,
    [id, req.account.id, sharePhone],
  );
  if (!row) fail(404, "Project contact not found.");
  res.json(row);
});

projectContacts.post("/projects/:id/contact/reveal", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const id = z.string().uuid().parse(req.params.id);
  const pro = req.account.id;
  if (req.account.role !== "pro")
    fail(403, "Only professionals can reveal a customer contact.");
  const contact = await transaction(async (client) => {
    // Serialize checks per professional so parallel requests share one allowance.
    await client.query("SELECT id FROM profiles WHERE id=$1 FOR UPDATE", [pro]);
    const {
      rows: [row],
    } = await client.query(
      `SELECT c.phone,p.customer_id ${eligibleContact} AND p.customer_id <> $2 FOR SHARE OF c`,
      [id, pro],
    );
    if (!row) fail(404, "Contact details are unavailable for this project.");
    const {
      rows: [usage],
    } = await client.query(
      `SELECT count(DISTINCT customer_id)::int AS total, bool_or(customer_id=$2) AS seen
       FROM project_contact_reveals WHERE pro_id=$1 AND revealed_at >= now() - interval '24 hours'`,
      [pro, row.customer_id],
    );
    if (!usage.seen && usage.total >= dailyDistinctCustomerLimit)
      fail(
        429,
        "You have reached the limit for new customer contacts. Try again later.",
      );
    await client.query(
      "INSERT INTO project_contact_reveals(pro_id, customer_id, project_id) VALUES ($1,$2,$3)",
      [pro, row.customer_id, id],
    );
    return { phone: row.phone };
  });
  res.json(contact);
});
