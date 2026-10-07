import type { Auth, MultiFactorConfig, UserRecord } from "firebase-admin/auth";
import { z } from "zod";

export class AdminSetupError extends Error {}
export function setupArguments(args: string[]) {
  const [address, ...flags] = args;
  const email = z.string().trim().email().max(254).safeParse(address);
  if (
    !email.success ||
    flags.some((flag) => !["--check", "--enable-totp"].includes(flag)) ||
    new Set(flags).size !== flags.length ||
    (flags.includes("--check") && flags.includes("--enable-totp"))
  )
    throw new AdminSetupError(
      "Usage: npm run admin:setup -- EMAIL [--check | --enable-totp]",
    );
  return {
    email: email.data,
    checkOnly: flags.includes("--check"),
    enableTotp: flags.includes("--enable-totp"),
  };
}
export function totpEnabled(config?: MultiFactorConfig) {
  return (
    config?.providerConfigs?.some(
      (provider) =>
        provider.state === "ENABLED" && !!provider.totpProviderConfig,
    ) === true
  );
}
export function withTotpEnabled(config?: MultiFactorConfig): MultiFactorConfig {
  return {
    // Preserve the existing phone-MFA state/factors and unrelated providers.
    ...config,
    state: config?.state || "DISABLED",
    providerConfigs: [
      ...(config?.providerConfigs || []).filter(
        (provider) => !provider.totpProviderConfig,
      ),
      { state: "ENABLED", totpProviderConfig: { adjacentIntervals: 1 } },
    ],
  };
}

export async function setupAdministrator(
  options: ReturnType<typeof setupArguments>,
  dependencies: {
    auth: Pick<Auth, "getUserByEmail" | "projectConfigManager">;
    allowedUids: string[];
    findRole: (uid: string) => Promise<string | null>;
    grant: (user: UserRecord) => Promise<void>;
    report: (message: string) => void;
  },
) {
  const { auth, allowedUids, findRole, grant, report } = dependencies;
  const user = await auth.getUserByEmail(options.email);
  report("Firebase account found. UID: " + user.uid);
  if (!allowedUids.includes(user.uid))
    throw new AdminSetupError(
      "Owner approval is required. Add this exact UID to the development/respective API's ADMIN_ALLOWED_UIDS, save and redeploy, then rerun this command. No permissions were granted.",
    );
  if (
    user.disabled ||
    !user.email ||
    !user.providerData.some((provider) => provider.providerId === "password")
  )
    throw new AdminSetupError(
      "Use an enabled, dedicated Firebase Email/Password identity. No permissions were granted.",
    );
  if (!user.emailVerified)
    throw new AdminSetupError(
      "Verify this account's email on the admin website first, then sign out and rerun this command. No permissions were granted.",
    );
  const role = await findRole(user.uid);
  if (role !== null && role !== "admin")
    throw new AdminSetupError(
      "This UID already belongs to a customer or professional. Use a dedicated administrator identity. No permissions were granted.",
    );
  const manager = auth.projectConfigManager();
  let config = (await manager.getProjectConfig()).multiFactorConfig;
  if (!totpEnabled(config)) {
    if (!options.enableTotp)
      throw new AdminSetupError(
        "TOTP is not enabled for this Firebase project. Upgrade to Firebase Authentication with Identity Platform, then rerun with --enable-totp. No permissions were granted.",
      );
    await manager.updateProjectConfig({
      multiFactorConfig: withTotpEnabled(config),
    });
    config = (await manager.getProjectConfig()).multiFactorConfig;
    if (!totpEnabled(config))
      throw new AdminSetupError(
        "Firebase did not confirm TOTP activation. Administrator permissions were not granted.",
      );
    report(
      "TOTP enabled. Existing phone MFA and other provider settings were retained.",
    );
  }
  if (options.checkOnly) {
    report(
      "Prerequisites passed. Read-only check: no role, claim or Firebase settings were changed. This does not prove sign-in or grant access.",
    );
    return;
  }
  await grant(user);
  report(
    "Administrator provisioned. Sign in on the admin website, enroll your authenticator, then sign in again with its code. Server authorization still applies to every request.",
  );
}
