import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config.js";
import { requireValue } from "../errors.js";
function client() {
  requireValue(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET,
    "File storage is not configured yet.",
  );
  return new S3Client({
    region: "auto",
    endpoint: "https://" + env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com",
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}
export async function uploadUrl(key: string, type: string, size: number) {
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ContentType: type,
      ContentLength: size,
    }),
    { expiresIn: 300 },
  );
}
export async function downloadUrl(key: string) {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ResponseContentDisposition: "attachment",
    }),
    { expiresIn: 120 },
  );
}
export async function inspectObject(key: string) {
  return client().send(
    new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  );
}
export async function removeObject(key: string) {
  await client().send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  );
}

export async function imageUrl(key: string) {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: 600 },
  );
}
export async function imageHeader(key: string) {
  const object = await client().send(
    new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Range: "bytes=0-11",
    }),
  );
  return object.Body
    ? await object.Body.transformToByteArray()
    : new Uint8Array();
}
