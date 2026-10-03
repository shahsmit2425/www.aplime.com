import { z } from "zod";
import { uploadSchema, MAX_PROJECT_IMAGES } from "../shared/uploads.js";
import { transaction } from "./db/index.js";
import { fail } from "./errors.js";
export async function reserveUpload(
  id: string,
  projectId: string,
  userId: string,
  key: string,
  data: z.infer<typeof uploadSchema>,
) {
  await transaction(async (c) => {
    await c.query("SELECT id FROM projects WHERE id=$1 FOR UPDATE", [
      projectId,
    ]);
    const counts = (
      await c.query(
        "SELECT count(*)::int AS total, count(*) FILTER (WHERE content_type LIKE 'image/%')::int AS images FROM uploads WHERE project_id=$1",
        [projectId],
      )
    ).rows[0];
    if (
      data.contentType.startsWith("image/") &&
      counts.images >= MAX_PROJECT_IMAGES
    )
      fail(409, "A project can have up to 5 images.");
    if (counts.total >= 50)
      fail(409, "This project has reached its attachment limit.");
    await c.query(
      "INSERT INTO uploads(id,project_id,user_id,object_key,name,content_type,size) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [id, projectId, userId, key, data.name, data.contentType, data.size],
    );
  });
}
