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
let s3: S3Client | undefined;
function client() {
  requireValue(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET,
    "File storage is not configured yet.",
  );
  // R2 rejects the default flexible checksums the AWS SDK signs into
  // presigned URLs (an empty-body CRC32 that never matches the browser PUT).
  s3 ??= new S3Client({
    region: "auto",
    endpoint: "https://" + env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com",
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return s3;
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
  imageUrls.delete(key);
  await client().send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  );
}

const IMAGE_URL_TTL = 600;
// Reusing a signature while it is still fresh keeps image URLs stable across
// workspace refreshes, so browsers cache instead of re-downloading every poll.
const imageUrls = new Map<string, { url: string; until: number }>();
export async function imageUrl(key: string) {
  const cached = imageUrls.get(key);
  if (cached && cached.until > Date.now()) return cached.url;
  const url = await getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: IMAGE_URL_TTL },
  );
  if (imageUrls.size > 5000)
    for (const [k, v] of imageUrls) if (v.until <= Date.now()) imageUrls.delete(k);
  imageUrls.set(key, { url, until: Date.now() + (IMAGE_URL_TTL - 180) * 1000 });
  return url;
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
