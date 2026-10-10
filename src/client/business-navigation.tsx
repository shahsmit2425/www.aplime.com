import {
  Building2,
  ShieldCheck,
  CreditCard,
  ClipboardCheck,
  CalendarDays,
} from "lucide-react";
import { useWorkspace } from "./workspace.js";
export const businessSections = [
  { page: "profile", label: "Profile & images", Icon: Building2 },
  { page: "verification", label: "Identity verification", Icon: ShieldCheck },
  { page: "subscription", label: "Membership", Icon: CreditCard },
  {
    page: "profile",
    id: "setup",
    label: "Marketplace review",
    Icon: ClipboardCheck,
  },
  { page: "availability", label: "Schedule & preferences", Icon: CalendarDays },
] as const;
export function BusinessNavigation() {
  const { page, id, go } = useWorkspace();
  return (
    <section className="business-account-navigation">
      <div>
        <p className="eyebrow">MY BUSINESS</p>
        <h2>Manage your business account</h2>
        <p>
          Your profile, identity, membership and listing review, together in one
          place.
        </p>
      </div>
      <nav aria-label="Business account sections">
        {businessSections.map((section) => {
          const targetId = "id" in section ? section.id : undefined;
          const active =
            page === section.page &&
            (targetId ? id === targetId : id !== "setup");
          return (
            <button
              key={section.label}
              aria-current={active ? "page" : undefined}
              onClick={() => go(section.page, targetId)}
            >
              <section.Icon size={18} />
              {section.label}
            </button>
          );
        })}
      </nav>
    </section>
  );
}
