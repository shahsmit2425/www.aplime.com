import { Router, json } from "express";
import { feedbackSchema } from "../shared/feedback.js";
import { consumeBudget } from "./abuse-limits.js";
import { clientNetwork } from "./client-ip.js";
import { pool } from "./db/index.js";
export const publicFeedback = Router();
publicFeedback.post(
  "/",
  async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Retry-After", "3600");
    await consumeBudget(
      "feedbackNetwork",
      clientNetwork(req, req.app.get("trust proxy fn")),
    );
    next();
  },
  json({ limit: "12kb" }),
  async (req, res) => {
    const input = feedbackSchema.parse(req.body);
    if (!input.website) {
      res.set("Retry-After", "86400");
      await consumeBudget("feedbackGlobal", "public-feedback");
      await pool.query(
        `INSERT INTO website_feedback(id,category,message,email,page) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`,
        [input.id, input.category, input.message, input.email, input.page],
      );
    }
    res.removeHeader("Retry-After");
    res.status(201).json({ ok: true });
  },
);
