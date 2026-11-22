import { useId, useState, type ReactNode } from "react";
import {
  ShieldCheck,
  FileText,
  CalendarDays,
  BriefcaseBusiness,
  MapPin,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { Brand } from "./ui.js";

// Every statement here repeats what the public pages already say about Aplime.
const audiences = {
  customer: {
    title: "Plan, discuss and schedule your home project in one place.",
    points: [
      [
        ShieldCheck,
        "Identity-verified professionals",
        "Stripe Identity verifies account holders. Aplime reviews each profile before it’s published.",
      ],
      [
        FileText,
        "Written, itemized estimates",
        "Talk through your project privately and compare estimates before you choose.",
      ],
      [
        CalendarDays,
        "Messages, calls and scheduling",
        "Project conversations, calls and visits stay together in your account.",
      ],
    ],
    note: "Aplime doesn’t process project payments, and identity verification doesn’t certify licensing, insurance or quality of work.",
  },
  pro: {
    title: "Reach local customers and manage your work in one place.",
    points: [
      [
        BriefcaseBusiness,
        "A reviewed business profile",
        "Show your services, past work and availability after identity verification and profile review.",
      ],
      [
        MapPin,
        "Relevant local opportunities",
        "Hear about projects that match your services and service area.",
      ],
      [
        FileText,
        "Estimates, messages and scheduling",
        "Send itemized written estimates and keep customer conversations together.",
      ],
    ],
    note: "Professionals pay Aplime a membership through Stripe. Customers pay the professional directly for the work.",
  },
} as const;

export function AuthAside({ role }: { role: "customer" | "pro" }) {
  const { title, points, note } = audiences[role];
  return (
    <aside className="auth-aside">
      <Brand />
      <div className="auth-aside-copy">
        <h2>{title}</h2>
        <ul>
          {points.map(([Icon, heading, text]) => (
            <li key={heading}>
              <Icon size={20} aria-hidden="true" />
              <span>
                <strong>{heading}</strong>
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="auth-aside-note">{note}</p>
    </aside>
  );
}

export function PasswordField({ creating }: { creating: boolean }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [length, setLength] = useState(0);
  return (
    <div className="field password-field">
      <span>
        <label htmlFor={id}>Password</label>
      </span>
      <div className="password-input">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name="password"
          minLength={creating ? 12 : 1}
          required
          autoComplete={creating ? "new-password" : "current-password"}
          aria-describedby={creating ? id + "-hint" : undefined}
          onChange={(event) => setLength(event.target.value.length)}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {creating && (
        <small id={id + "-hint"} className={length >= 12 ? "met" : undefined}>
          {length >= 12 && <Check size={15} aria-hidden="true" />} Use at least
          12 characters.
        </small>
      )}
    </div>
  );
}

export function GoogleButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="secondary google-button"
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      Continue with Google
    </button>
  );
}

export function AuthBadge({ children }: { children: ReactNode }) {
  return (
    <span className="auth-badge" aria-hidden="true">
      {children}
    </span>
  );
}
