import test from "node:test";
import assert from "node:assert/strict";
import type { Auth, MultiFactorConfig, UserRecord } from "firebase-admin/auth";
import {
  setupAdministrator,
  setupArguments,
  withTotpEnabled,
} from "../scripts/lib/admin-setup.js";
import {
  adminAuthError,
  adminLoginDestination,
  requestAdminPasswordReset,
} from "../apps/admin/auth-flow.js";

const enabled: MultiFactorConfig = {
  state: "DISABLED",
  providerConfigs: [
    { state: "ENABLED", totpProviderConfig: { adjacentIntervals: 1 } },
  ],
};
function fixture(
  overrides: {
    user?: Partial<UserRecord>;
    allowed?: string[];
    role?: string | null;
    config?: MultiFactorConfig;
    confirmUpdate?: boolean;
    grantFailure?: boolean;
  } = {},
) {
  const user = {
    uid: "owner-approved",
    email: "owner@example.invalid",
    emailVerified: true,
    disabled: false,
    providerData: [{ providerId: "password" }],
    ...overrides.user,
  } as UserRecord;
  let config = overrides.config ?? enabled;
  const changes: MultiFactorConfig[] = [],
    granted: string[] = [],
    reports: string[] = [];
  const dependencies = {
    auth: {
      getUserByEmail: async (email: string) => {
        assert.equal(email, "owner@example.invalid");
        return user;
      },
      projectConfigManager: () => ({
        getProjectConfig: async () => ({ multiFactorConfig: config }),
        updateProjectConfig: async (update: {
          multiFactorConfig: MultiFactorConfig;
        }) => {
          changes.push(update.multiFactorConfig);
          if (overrides.confirmUpdate !== false)
            config = update.multiFactorConfig;
        },
      }),
    } as unknown as Pick<Auth, "getUserByEmail" | "projectConfigManager">,
    allowedUids: overrides.allowed ?? ["owner-approved"],
    findRole: async (uid: string) => {
      assert.equal(uid, user.uid);
      return overrides.role ?? null;
    },
    grant: async (account: UserRecord) => {
      if (overrides.grantFailure) throw new Error("grant failed");
      granted.push(account.uid);
    },
    report: (message: string) => reports.push(message),
  };
  return { dependencies, changes, granted, reports };
}
const email = "owner@example.invalid";
test("password recovery does not disclose missing accounts and still reports delivery or configuration failures", async () => {
  await assert.doesNotReject(requestAdminPasswordReset(async () => {}));
  await assert.doesNotReject(
    requestAdminPasswordReset(async () => {
      throw { code: "auth/user-not-found" };
    }),
  );
  await assert.rejects(
    requestAdminPasswordReset(async () => {
      throw new Error("network failure");
    }),
    /network failure/,
  );
});
test("owner setup accepts an email and one explicit mode, never a password or arbitrary flags", () => {
  assert.deepEqual(setupArguments([` ${email} `, "--check"]), {
    email,
    checkOnly: true,
    enableTotp: false,
  });
  for (const args of [
    [],
    ["invalid"],
    [email, "password"],
    [email, "--grant-anyone"],
    [email, "--check", "--enable-totp"],
    [email, "--check", "--check"],
  ])
    assert.throws(() => setupArguments(args));
});
test("unapproved, unverified, disabled and marketplace identities cannot grant access or change MFA", async () => {
  for (const options of [
    { allowed: [] },
    { user: { emailVerified: false } },
    { user: { disabled: true } },
    { user: { providerData: [] } },
    { role: "customer" },
    { role: "pro" },
  ]) {
    const f = fixture({ ...options, config: { state: "DISABLED" } });
    await assert.rejects(
      setupAdministrator(
        setupArguments([email, "--enable-totp"]),
        f.dependencies,
      ),
    );
    assert.deepEqual(f.changes, []);
    assert.deepEqual(f.granted, []);
  }
});
test("read-only setup checks do not grant claims, roles or change project settings", async () => {
  const f = fixture();
  await setupAdministrator(setupArguments([email, "--check"]), f.dependencies);
  assert.deepEqual(f.changes, []);
  assert.deepEqual(f.granted, []);
  assert.match(f.reports.at(-1)!, /Read-only/);
  const disabled = fixture({ config: { state: "DISABLED" } });
  await assert.rejects(
    setupAdministrator(
      setupArguments([email, "--check"]),
      disabled.dependencies,
    ),
    /TOTP is not enabled/,
  );
  assert.deepEqual(disabled.changes, []);
  assert.deepEqual(disabled.granted, []);
});
test("TOTP enablement requires explicit consent, preserves other settings and confirms activation before grant", async () => {
  const config: MultiFactorConfig = {
    state: "ENABLED",
    factorIds: ["phone"],
    providerConfigs: [
      { state: "DISABLED", totpProviderConfig: { adjacentIntervals: 5 } },
    ],
  };
  const ordinary = fixture({ config });
  await assert.rejects(
    setupAdministrator(setupArguments([email]), ordinary.dependencies),
    /TOTP is not enabled/,
  );
  assert.deepEqual(ordinary.changes, []);
  assert.deepEqual(ordinary.granted, []);
  const explicit = fixture({ config });
  await setupAdministrator(
    setupArguments([email, "--enable-totp"]),
    explicit.dependencies,
  );
  assert.deepEqual(explicit.changes, [withTotpEnabled(config)]);
  assert.equal(explicit.changes[0].state, "ENABLED");
  assert.deepEqual(explicit.changes[0].factorIds, ["phone"]);
  assert.equal(explicit.changes[0].providerConfigs?.length, 1);
  assert.deepEqual(explicit.granted, ["owner-approved"]);
  const unconfirmed = fixture({ config, confirmUpdate: false });
  await assert.rejects(
    setupAdministrator(
      setupArguments([email, "--enable-totp"]),
      unconfirmed.dependencies,
    ),
    /did not confirm/,
  );
  assert.deepEqual(unconfirmed.granted, []);
});
test("existing enabled TOTP is not rewritten and a failed provisioner cannot report success", async () => {
  const f = fixture({ role: "admin" });
  await setupAdministrator(
    setupArguments([email, "--enable-totp"]),
    f.dependencies,
  );
  assert.deepEqual(f.changes, []);
  assert.deepEqual(f.granted, ["owner-approved"]);
  const failure = fixture({ grantFailure: true });
  await assert.rejects(
    setupAdministrator(setupArguments([email]), failure.dependencies),
    /grant failed/,
  );
  assert.ok(
    failure.reports.every(
      (message) => !message.includes("Administrator provisioned"),
    ),
  );
});
test("Firebase read/update failures stop provisioning and never report an administrator grant", async () => {
  for (const operation of ["read", "update"] as const) {
    const f = fixture({ config: { state: "DISABLED" } });
    f.dependencies.auth.projectConfigManager = (() => ({
      getProjectConfig: async () => {
        if (operation === "read") throw new Error("provider unavailable");
        return { multiFactorConfig: { state: "DISABLED" } };
      },
      updateProjectConfig: async () => {
        throw new Error("insufficient permissions");
      },
    })) as unknown as typeof f.dependencies.auth.projectConfigManager;
    await assert.rejects(
      setupAdministrator(
        setupArguments([email, "--enable-totp"]),
        f.dependencies,
      ),
    );
    assert.deepEqual(f.granted, []);
    assert.ok(
      f.reports.every(
        (message) => !message.includes("Administrator provisioned"),
      ),
    );
  }
});
test("admin guidance requires verified email and a strictly boolean server claim before enrollment or workspace", () => {
  assert.equal(adminLoginDestination(false, true, true), "verify_email");
  for (const claim of [undefined, false, "true", 1])
    assert.equal(adminLoginDestination(true, claim, true), "approval");
  assert.equal(adminLoginDestination(true, true, false), "enroll");
  assert.equal(adminLoginDestination(true, true, true), "workspace");
  assert.equal(
    adminAuthError({ code: "auth/user-not-found" }),
    adminAuthError({ code: "auth/wrong-password" }),
  );
  assert.ok(
    !adminAuthError({
      code: "auth/unknown",
      message: "provider-internal-secret",
    }).includes("provider-internal-secret"),
  );
  assert.match(
    adminAuthError({ code: "auth/invalid-verification-code" }),
    /current six-digit/,
  );
});
