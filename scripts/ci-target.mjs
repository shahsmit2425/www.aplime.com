import fs from "node:fs";
const mapping = JSON.parse(fs.readFileSync("config/environments.json", "utf8"));
const { EVENT_NAME, HEAD_BRANCH, BASE_BRANCH, REF_BRANCH, GITHUB_OUTPUT } =
  process.env;
const branch = EVENT_NAME === "pull_request" ? BASE_BRANCH : REF_BRANCH;
if (
  EVENT_NAME === "pull_request" &&
  ((BASE_BRANCH === "main" && HEAD_BRANCH !== "stagging") ||
    (BASE_BRANCH === "stagging" && HEAD_BRANCH !== "development"))
)
  throw new Error(
    "Promote development → stagging → main. Start new work from development.",
  );
const target = mapping[branch];
if (!target) throw new Error("This branch has no deployment target.");
if (GITHUB_OUTPUT)
  fs.appendFileSync(
    GITHUB_OUTPUT,
    "environment=" +
      target.environment +
      "\napp-id=" +
      target.appId +
      "\nios-app-id=" +
      target.iosAppId +
      "\nandroid-track=" +
      target.androidTrack +
      "\n",
  );
console.log("Selected " + target.environment + ".");
