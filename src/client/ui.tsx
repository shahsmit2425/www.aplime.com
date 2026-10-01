import type { ReactNode, FormEvent } from "react";
import { House, ArrowUpRight, Inbox } from "lucide-react";
export function Brand() {
  return (
    <a className="brand" href="/">
      <span>
        <House size={23} />
      </span>
      ap<strong>lime</strong>
      <i />
    </a>
  );
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
        void onSubmit(new FormData(e.currentTarget));
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
