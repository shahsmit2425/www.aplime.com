import { Router } from "express";
import { z } from "zod";
import { pool } from "./db/index.js";
import { matchSql, unblockedSql } from "./matching.js";
export const projectContacts = Router();
projectContacts.get("/projects/:id/contact", async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const row = (
    await pool.query(
      `SELECT c.phone,c.consent_at AS "consentAt" FROM project_contacts c JOIN projects p ON p.id=c.project_id
 WHERE p.id=$1 AND (p.customer_id=$2 OR EXISTS(SELECT 1 FROM profiles f WHERE f.id=$2 AND NOT f.suspended AND ${unblockedSql()} AND (p.pro_id=f.id OR (p.pro_id IS NULL AND p.status IN ('requested','quoted') AND ${matchSql()}))))`,
      [id, req.account.id],
    )
  ).rows[0];
  res.set("Cache-Control", "no-store").json(row || null);
});
