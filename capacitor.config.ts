import type { CapacitorConfig } from "@capacitor/cli";
import environments from "./config/environments.json";
import { execFileSync } from "node:child_process";
const branch =
  process.env.GITHUB_REF_NAME ||
  execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  }).trim();
const target = process.env.APP_ENV
  ? Object.values(environments).find(
      (e) => e.environment === process.env.APP_ENV,
    )
  : environments[branch as keyof typeof environments] ||
    environments.development;
if (!target) throw new Error("Unknown mobile APP_ENV.");
const config: CapacitorConfig = {
  appId: process.env.MOBILE_PLATFORM === "ios" ? target.iosAppId : target.appId,
  appName: target.appName,
  webDir: "dist/client",
  server: { androidScheme: "https" },
  ios: { contentInset: "automatic" },
  android: { backgroundColor: "#f7f9fc" },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ["google.com"],
    },
  },
};
export default config;
