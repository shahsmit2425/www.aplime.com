import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CreditCard,
  LifeBuoy,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { T } from "../shared/language.js";
import { emailCategories } from "../shared/email-alerts.js";
import { request } from "./api.js";
import { usesPassword } from "./auth.js";
import { PushSettings } from "./push.js";
import { Field, Form, Head, Panel } from "./ui.js";
import { useWorkspace } from "./workspace.js";
import { AccountClosure, PasswordForm, Sessions } from "./account-data.js";

const sections = [
  { id: "account", label: "Account", Icon: UserRound },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "privacy", label: "Privacy", Icon: ShieldCheck },
  { id: "security", label: "Sign-in & security", Icon: LockKeyhole },
] as const;
type Section = (typeof sections)[number]["id"];
type Categories = Record<keyof typeof emailCategories, boolean>;
const categoryKeys = Object.keys(emailCategories) as (keyof Categories)[];

function Toggle({
  checked,
  onChange,
  disabled,
  title,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  title: string;
  children?: ReactNode;
}) {
  return (
    <label className="settings-toggle" data-disabled={disabled || undefined}>
      <span>
        <strong>{title}</strong>
        {children && <small>{children}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function Settings() {
  const { data, run, busy, go, id } = useWorkspace();
  const [section, setSection] = useState<Section>(
    sections.some((item) => item.id === id) ? (id as Section) : "account",
  );
  const saved = data.user.settings.emailCategories as
    Partial<Categories> | undefined;
  const [alerts, setAlerts] = useState(
    data.user.settings.emailAlerts !== false,
  );
  const [categories, setCategories] = useState(
    () =>
      Object.fromEntries(
        categoryKeys.map((key) => [key, saved?.[key] !== false]),
      ) as Categories,
  );
  const pro = data.user.role === "pro";
  // One endpoint stores the name and the email choices together.
  const save = (name: string, message: string) =>
    run(
      () =>
        request(
          "/account",
          { name, emailAlerts: alerts, emailCategories: categories },
          "PUT",
        ),
      message,
    );
  const shortcuts = [
    ...(pro
      ? ([
          ["profile", "Business profile", BriefcaseBusiness],
          ["availability", "Services & hours", CalendarClock],
          ["subscription", "Membership & billing", CreditCard],
        ] as const)
      : []),
    ["help", "Help & safety", LifeBuoy] as const,
  ];
  return (
    <>
      <Head title={<T>{"Settings"}</T>} />
      <div className="settings">
        <nav className="settings-nav" aria-label="Settings sections">
          <ul>
            {sections.map(({ id, label, Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  aria-current={section === id ? "page" : undefined}
                  onClick={() => setSection(id)}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <p>{pro ? "Your business" : "More"}</p>
          <ul>
            {shortcuts.map(([page, label, Icon]) => (
              <li key={page}>
                <button type="button" onClick={() => go(page)}>
                  <Icon size={18} aria-hidden="true" />
                  {label}
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="settings-body">
          {section === "account" && (
            <>
              <Panel title="Account">
                <div className="settings-identity">
                  <span aria-hidden="true">
                    {data.user.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div>
                    <strong>{data.user.name}</strong>
                    <small>{data.user.email}</small>
                  </div>
                  <em>{pro ? "Professional account" : "Customer account"}</em>
                </div>
                <Form
                  busy={busy}
                  onSubmit={(f) =>
                    save(String(f.get("name") || ""), "Account details saved.")
                  }
                >
                  <div className="settings-pair">
                    <Field label="Your name">
                      <input
                        name="name"
                        defaultValue={data.user.name}
                        maxLength={80}
                        autoComplete="name"
                        required
                      />
                    </Field>
                    <Field label="Email">
                      <input value={data.user.email} disabled />
                    </Field>
                  </div>
                  <dl className="settings-facts">
                    <div>
                      <dt>Sign-in method</dt>
                      <dd>
                        {usesPassword() ? "Email and password" : "Google"}
                      </dd>
                    </div>
                  </dl>
                  <button>Save changes</button>
                </Form>
              </Panel>
              <AccountClosure />
            </>
          )}
          {section === "notifications" && (
            <>
              <PushSettings />
              <Panel title="Email notifications">
                <Toggle
                  title="Email alerts"
                  checked={alerts}
                  onChange={setAlerts}
                  disabled={busy}
                >
                  Sent to {data.user.email}
                </Toggle>
                <div className="settings-toggles">
                  {categoryKeys
                    .filter((key) => pro || key !== "business")
                    .map((key) => (
                      <Toggle
                        key={key}
                        title={emailCategories[key]}
                        checked={alerts && categories[key]}
                        disabled={busy || !alerts}
                        onChange={(value) =>
                          setCategories({ ...categories, [key]: value })
                        }
                      />
                    ))}
                </div>
                <p className="settings-hint">
                  <T>
                    {
                      "Essential account, security, billing and support emails are still sent."
                    }
                  </T>
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void save(data.user.name, "Notification settings saved.")
                  }
                >
                  Save notification settings
                </button>
              </Panel>
            </>
          )}
          {section === "privacy" && (
            <Panel title="Blocked conversations">
              {data.blocked.length ? (
                data.blocked.map((id) => (
                  <div className="payment-row" key={id}>
                    <span>
                      {data.profiles.find((p) => p.id === id)?.name ||
                        "Project participant"}
                    </span>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          request("/blocked/" + id, { blocked: false }),
                        )
                      }
                    >
                      <T>{"Unblock"}</T>
                    </button>
                  </div>
                ))
              ) : (
                <p className="settings-empty">
                  <T>{"No blocked conversations."}</T>
                </p>
              )}
            </Panel>
          )}
          {section === "security" && (
            <>
              <PasswordForm />
              <Sessions />
            </>
          )}
        </div>
      </div>
    </>
  );
}
