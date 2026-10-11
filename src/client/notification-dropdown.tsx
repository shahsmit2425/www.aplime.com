import { useEffect, useRef } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import type { Notice } from "../shared/domain.js";
import { request } from "./api.js";
export function NotificationDropdown({
  open,
  setOpen,
  notices,
  unread,
  connected,
  busy,
  run,
  go,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  notices: Notice[];
  unread: number;
  connected: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
  go: (page: string, id?: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="notification-dropdown" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="icon-button"
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        aria-controls="recent-notifications"
        onClick={() => setOpen(!open)}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="notification-count">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <section
          id="recent-notifications"
          className="notification-popover"
          aria-label="Recent notifications"
        >
          <header>
            <div>
              <h2>Notifications</h2>
              <small>
                {unread} unread · {connected ? "Live" : "Reconnecting"}
              </small>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close notifications"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={17} />
            </button>
          </header>
          <div className="notification-popover-list">
            {notices.slice(0, 8).map((n) => (
              <button
                type="button"
                key={n.id}
                className={"notification-preview" + (n.read ? "" : " unread")}
                disabled={busy}
                onClick={() => {
                  void run(
                    () => request(`/notifications/${n.id}/read`, {}),
                    "",
                  );
                  if (n.targetPage && n.targetPage !== "notifications") {
                    setOpen(false);
                    go(n.targetPage, n.targetId || undefined);
                  }
                }}
              >
                <strong>{n.title}</strong>
                <span>{n.body}</span>
                <time dateTime={n.createdAt}>
                  {new Date(n.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
                {!n.read && <i aria-label="Unread" />}
              </button>
            ))}
          </div>
          {!notices.length && (
            <p className="notification-popover-empty">You’re all caught up.</p>
          )}
          <footer>
            <button
              className="text-button"
              type="button"
              disabled={busy || !unread}
              onClick={() =>
                void run(() => request("/notifications/read", {}), "")
              }
            >
              <CheckCheck size={16} />
              Mark all read
            </button>
            <small>Latest {Math.min(notices.length, 8)} updates</small>
          </footer>
        </section>
      )}
    </div>
  );
}
