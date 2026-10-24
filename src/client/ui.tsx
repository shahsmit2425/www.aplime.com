import type { ReactNode, FormEvent, MouseEventHandler } from "react";
import {
  ArrowUpRight,
  Inbox,
  Wrench,
  Sparkles,
  Droplets,
  Zap,
  Paintbrush,
  TreePine,
  Truck,
  Fan,
  House,
  Trees,
  Refrigerator,
  Bug,
} from "lucide-react";
export function Brand({
  href = "/",
  onClick,
}: {
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
} = {}) {
  const openHome: MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    // Public pages are server-rendered. Resolve the browser's session only
    // when the logo is clicked, without putting account data in public HTML.
    void (async () => {
      try {
        const { auth } = await import("./auth.js");
        const session = auth();
        await session.authStateReady();
        window.location.assign(session.currentUser ? "/app/dashboard" : "/");
      } catch {
        window.location.assign("/");
      }
    })();
  };
  return (
    <a className="brand" href={href} onClick={onClick || openHome}>
      <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <path className="mark-left" d="M7 50 26 14h10L18 50Z" />
        <path className="mark-right" d="m31 14 22 36H41L25 24Z" />
        <path
          className="mark-leaf"
          d="M35 19C40 7 50 5 58 7c-1 10-7 19-20 19 4-6 9-11 15-15-7 2-13 6-18 12Z"
        />
        <path
          className="mark-window"
          d="M27 39h5v5h-5zm7 0h5v5h-5zm-7 7h5v5h-5zm7 0h5v5h-5z"
        />
      </svg>
      <span className="brand-type">
        <b>Aplime</b>
        <small>Home services made simple</small>
      </span>
    </a>
  );
}
export function ServiceIcon({
  service,
  size = 24,
}: {
  service: string;
  size?: number;
}) {
  const props = { size, strokeWidth: 1.9, "aria-hidden": true as const };
  switch (service) {
    case "Handyman":
      return <Wrench {...props} />;
    case "Cleaning":
      return <Sparkles {...props} />;
    case "Plumbing":
      return <Droplets {...props} />;
    case "Electrical":
      return <Zap {...props} />;
    case "Painting":
      return <Paintbrush {...props} />;
    case "Landscaping":
      return <TreePine {...props} />;
    case "Junk Removal":
      return <Truck {...props} />;
    case "HVAC":
      return <Fan {...props} />;
    case "Roofing":
      return <House {...props} />;
    case "Tree Services":
      return <Trees {...props} />;
    case "Appliance Repair":
      return <Refrigerator {...props} />;
    case "Pest Control":
      return <Bug {...props} />;
    default:
      return <Wrench {...props} />;
  }
}
export function Empty({
  title = "Nothing here yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      <div className="empty-body">
        {children || "Your activity will appear here when you get started."}
      </div>
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function Head({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function Panel({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Form({
  onSubmit,
  children,
  busy = false,
}: {
  onSubmit: (data: FormData) => Promise<void>;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <form
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const submitter = (e.nativeEvent as SubmitEvent).submitter as
          HTMLButtonElement | HTMLInputElement | null;
        if (submitter?.name) data.set(submitter.name, submitter.value);
        void onSubmit(data);
      }}
    >
      <fieldset disabled={busy}>{children}</fieldset>
    </form>
  );
}
export function LinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className="button" href={href}>
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}
