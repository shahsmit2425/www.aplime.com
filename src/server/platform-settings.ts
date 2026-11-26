import { pool } from "./db/index.js";
import { fail } from "./errors.js";

type SwitchDefinition = {
  kind: "switch";
  label: string;
  description: string;
  default: boolean;
  pausedMessage: string;
};
type LimitDefinition = {
  kind: "limit";
  label: string;
  description: string;
  default: number;
  min: number;
  max: number;
};
const pause = (label: string, description: string, pausedMessage: string) =>
  ({
    kind: "switch",
    label,
    description,
    default: false,
    pausedMessage,
  }) satisfies SwitchDefinition;
const limit = (
  label: string,
  description: string,
  fallback: number,
  min: number,
  max: number,
) =>
  ({
    kind: "limit",
    label,
    description,
    default: fallback,
    min,
    max,
  }) satisfies LimitDefinition;

// Every runtime-editable value is declared here with its coded default and hard bounds.
export const settingDefinitions = {
  pauseRegistrations: pause(
    "Pause new registrations",
    "Stops new customer and professional accounts from being created. Existing accounts are unaffected.",
    "New registrations are temporarily paused. Please try again later.",
  ),
  pauseProjectSubmissions: pause(
    "Pause project submissions",
    "Stops customers from publishing new projects. Existing projects continue.",
    "New projects are temporarily paused. Please try again later.",
  ),
  pauseVideoBookings: pause(
    "Pause new call bookings",
    "Stops new call requests. Calls that are already scheduled can still be answered and joined.",
    "New call bookings are temporarily paused. Please try again later.",
  ),
  pauseNewSubscriptions: pause(
    "Pause new subscriptions",
    "Stops new membership checkouts. Existing subscriptions, renewals and the billing portal are unaffected.",
    "New memberships are temporarily paused. Please try again later.",
  ),
  projectAlertLimit: limit(
    "Professionals alerted per batch",
    "How many of the best-ranked matching professionals are alerted in one outreach batch for a project.",
    5,
    1,
    20,
  ),
  projectOutreachLimit: limit(
    "Professionals alerted per project",
    "The most professionals that can ever be alerted about one project across all batches.",
    15,
    1,
    50,
  ),
  dailyContactRevealLimit: limit(
    "Customer phone reveals per professional per day",
    "Distinct customers whose phone number one professional can reveal in 24 hours.",
    10,
    1,
    100,
  ),
  projectsPerDay: limit(
    "New projects per customer per day",
    "Projects one customer can publish in 24 hours.",
    10,
    1,
    100,
  ),
  messagesPerMinute: limit(
    "Messages per account per minute",
    "Project chat messages one account can send in a minute.",
    20,
    1,
    120,
  ),
  messagesPerDay: limit(
    "Messages per account per day",
    "Project chat messages one account can send in 24 hours.",
    500,
    10,
    5000,
  ),
  supportRequestsPerDay: limit(
    "Support requests per account per day",
    "New support conversations one account can open in 24 hours.",
    5,
    1,
    50,
  ),
  supportRepliesPerHour: limit(
    "Support replies per account per hour",
    "Support messages one account can send in an hour.",
    30,
    1,
    200,
  ),
} as const;

export type SettingKey = keyof typeof settingDefinitions;
type SettingValue<K extends SettingKey> =
  (typeof settingDefinitions)[K]["kind"] extends "switch" ? boolean : number;
export type PlatformSettings = { [K in SettingKey]: SettingValue<K> };
type SwitchKey = {
  [K in SettingKey]: (typeof settingDefinitions)[K]["kind"] extends "switch"
    ? K
    : never;
}[SettingKey];

export const settingKeys = Object.keys(settingDefinitions) as SettingKey[];
export const settingDefaults = Object.fromEntries(
  settingKeys.map((key) => [key, settingDefinitions[key].default]),
) as PlatformSettings;

export function validSetting(key: SettingKey, value: unknown) {
  const definition: SwitchDefinition | LimitDefinition =
    settingDefinitions[key];
  return definition.kind === "switch"
    ? typeof value === "boolean"
    : Number.isInteger(value) &&
        (value as number) >= definition.min &&
        (value as number) <= definition.max;
}

// Short cache so a change made on one API instance reaches the others quickly.
const CACHE_MS = 10_000;
let cached: { expires: number; value: PlatformSettings } | undefined;
export function clearSettingsCache() {
  cached = undefined;
}
// Callers inside a transaction pass their client so a refresh never waits for a second connection.
export async function platformSettings(
  db: { query: (sql: string) => Promise<{ rows: any[] }> } = pool,
): Promise<PlatformSettings> {
  if (cached && cached.expires > Date.now()) return cached.value;
  const stored = await db.query("SELECT key,value FROM platform_settings");
  const value: Record<string, unknown> = { ...settingDefaults };
  for (const row of stored.rows)
    if (
      settingKeys.includes(row.key) &&
      validSetting(row.key as SettingKey, row.value)
    )
      value[row.key] = row.value;
  cached = { expires: Date.now() + CACHE_MS, value: value as PlatformSettings };
  return cached.value;
}
export async function assertNotPaused(key: SwitchKey) {
  if ((await platformSettings())[key])
    fail(503, settingDefinitions[key].pausedMessage);
}
