import { raw, type RequestHandler } from "express";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../shared/uploads.js";
import { fail } from "./errors.js";

// One pool per image type. Hold the slot through processing even if the client disconnects.
export function imageUploadBody(deadlineMs = 25_000): RequestHandler {
  const receiving = new Set<string>();
  const parse = raw({
    type: [...IMAGE_TYPES],
    limit: MAX_UPLOAD_BYTES,
    inflate: false,
  });
  return (req, res, next) => {
    const account = req.account.id;
    if (receiving.size >= 4 || receiving.has(account))
      fail(429, "Another image is uploading. Please retry shortly.");
    if (req.destroyed || res.destroyed) return;
    receiving.add(account);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      clearTimeout(timer);
      receiving.delete(account);
    };
    const timer = setTimeout(() => {
      release();
      req.destroy();
    }, deadlineMs);
    res.locals.releaseUpload = release;
    res.once("close", release);
    parse(req, res, (error) => {
      clearTimeout(timer);
      if (error || released || req.aborted) {
        release();
        if (error) next(error);
        return;
      }
      res.off("close", release);
      next();
    });
  };
}
