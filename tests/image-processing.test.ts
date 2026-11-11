import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  sanitizeImage,
  MAX_IMAGE_EDGE,
} from "../src/server/image-processing.js";

const base = (width = 64, height = 48) =>
  sharp({
    create: { width, height, channels: 3, background: "#3a7" },
  });

test("sanitizing a JPEG removes EXIF, GPS and other embedded metadata", async () => {
  const original = await base()
    .jpeg()
    .withExif({
      IFD0: { ImageDescription: "front-door-secret", Copyright: "owner" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "40/1 44/1 0/1",
        GPSLongitudeRef: "W",
        GPSLongitude: "74/1 0/1 0/1",
      },
    })
    .toBuffer();
  assert.ok(original.includes(Buffer.from("front-door-secret")));
  assert.ok((await sharp(original).metadata()).exif);
  const clean = await sanitizeImage(original, "image/jpeg");
  assert.equal((await sharp(clean).metadata()).exif, undefined);
  assert.equal(clean.includes(Buffer.from("front-door-secret")), false);
  assert.equal((await sharp(clean).metadata()).format, "jpeg");
});

test("sanitizing bakes EXIF orientation into the pixels", async () => {
  const rotated = await base(64, 48)
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const clean = await sanitizeImage(rotated, "image/jpeg");
  const meta = await sharp(clean).metadata();
  assert.equal(meta.width, 48);
  assert.equal(meta.height, 64);
  assert.ok(!meta.orientation || meta.orientation === 1);
});

test("PNG and WebP uploads are re-encoded in their own format", async () => {
  for (const [type, format] of [
    ["image/png", "png"],
    ["image/webp", "webp"],
  ] as const) {
    const source = await base().toFormat(format).toBuffer();
    const clean = await sanitizeImage(source, type);
    assert.equal((await sharp(clean).metadata()).format, format);
  }
});

test("oversized images are scaled down and small ones are not enlarged", async () => {
  const large = await base(MAX_IMAGE_EDGE + 800, 400)
    .png()
    .toBuffer();
  const meta = await sharp(await sanitizeImage(large, "image/png")).metadata();
  assert.equal(meta.width, MAX_IMAGE_EDGE);
  const small = await base(64, 48).png().toBuffer();
  assert.equal(
    (await sharp(await sanitizeImage(small, "image/png")).metadata()).width,
    64,
  );
});

test("files that are not the declared image type are rejected", async () => {
  const png = await base().png().toBuffer();
  await assert.rejects(sanitizeImage(png, "image/jpeg"), { status: 400 });
  await assert.rejects(
    sanitizeImage(Buffer.from("not an image"), "image/png"),
    {
      status: 400,
    },
  );
  const jpegHeaderOnly = Buffer.from([255, 216, 255, 224, 0, 16, 74, 70]);
  await assert.rejects(sanitizeImage(jpegHeaderOnly, "image/jpeg"), {
    status: 400,
  });
  await assert.rejects(sanitizeImage(png, "application/pdf"), { status: 415 });
});
