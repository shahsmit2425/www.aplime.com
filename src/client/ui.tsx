import type { ReactNode, FormEvent } from "react";
import {
  ArrowUpRight,
  Inbox,
  Wrench,
  Sparkles,
  Droplets,
  Zap,
  Paintbrush,
  TreePine,
} from "lucide-react";
export function Brand() {
  return (
    <a className="brand" href="/">
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
      <p>
        {children || "Your activity will appear here when you get started."}
      </p>
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
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">YOUR HOME, CONNECTED</p>
        <h1>{title}</h1>
        <p>{children}</p>
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
