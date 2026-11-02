import { pool } from "../src/server/db/index.js";
import { env } from "../src/server/config.js";
import { localDirectoryProfiles } from "../src/server/repository.js";
import { preferenceFingerprint } from "../src/server/local-coverage-policy.js";
import { publicLocalDirectory } from "../src/server/local-directory.js";
import {
  directoryPaths,
  locationPage,
  pageListings,
  uniquePros,
  qualifies,
} from "../src/shared/local-directory.js";

// Trusted backend shell only; never writes or publishes anything.
try {
  console.log(`Read-only local SEO check (${env.APP_ENV})`);
  const [flag, value] = process.argv.slice(2);
  if (flag === "--pro" && value) {
    const [record] = await localDirectoryProfiles([value]);
    if (!record)
      throw new Error(
        "Business is not eligible for the public local directory.",
      );
    console.log({
      id: record.profile.id,
      business: record.profile.business,
      categories: record.profile.serviceCategories,
      preferenceFingerprint: preferenceFingerprint(record.row),
    });
    console.log(
      "This fingerprint does not prove coverage. Obtain and document coverage evidence separately.",
    );
  } else if (flag === "--page" && value) {
    const page = locationPage(value);
    if (!page) throw new Error("Unknown canonical location path.");
    const directory = await publicLocalDirectory();
    const listings = pageListings(page, directory);
    console.log({
      path: value,
      businesses: uniquePros(listings).length,
      services: new Set(listings.map((l) => l.service)).size,
      municipalities: new Set(listings.map((l) => l.municipalityId)).size,
      meetsSupplyThreshold: qualifies(page, directory),
      currentlyIndexable: directoryPaths(directory).includes(value),
    });
    if (!qualifies(page, directory)) process.exitCode = 1;
  } else {
    throw new Error(
      "Usage: npm run seo:check -- --pro USER_ID | --page /nj/parsippany/plumbing",
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Local SEO check failed.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
