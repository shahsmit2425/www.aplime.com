import { useEffect, useRef, useState } from "react";
import {
  CalendarPlus,
  CalendarDays,
  Phone,
  Video,
  X,
  RefreshCw,
  Check,
  XCircle,
} from "lucide-react";
import {
  callCanJoin,
  CALL_MINUTES,
  type CallMeeting,
  type CallSlots,
} from "../shared/meetings.js";
import { request, openExternal } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { Badge } from "./ui.js";
const changed = () => window.dispatchEvent(new Event("aplime:meetings"));
const when = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
const localDay = (s: string) => new Date(s).toLocaleDateString("en-CA");
export function ScheduleCallButton({
  projectId,
  proId,
  label = "Schedule call",
}: {
  projectId: string;
  proId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { go } = useWorkspace();
  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        <CalendarPlus size={16} />
        {label}
      </button>
      {open && (
        <CallScheduler
          projectId={projectId}
          proId={proId}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            go("schedule");
          }}
        />
      )}
    </>
  );
}
export function CallScheduler({
  projectId,
  proId,
  meeting,
  onClose,
  onDone,
}: {
  projectId: string;
  proId: string;
  meeting?: CallMeeting;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null),
    requestId = useRef(crypto.randomUUID());
  const [slots, setSlots] = useState<CallSlots | null>(null),
    [day, setDay] = useState(""),
    [time, setTime] = useState(""),
    [mode, setMode] = useState<"audio" | "video">(meeting?.mode || "video"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [stale, setStale] = useState(false);
  const profile = data.profiles.find((p) => p.id === proId),
    project =
      data.projects.find((p) => p.id === projectId) ||
      data.leads.find((p) => p.id === projectId);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let active = true;
    setSlots(null);
    setTime("");
    void request<CallSlots>(
      `/projects/${projectId}/professionals/${encodeURIComponent(proId)}/call-slots` +
        (meeting ? `?meetingId=${meeting.id}` : ""),
    )
      .then((r) => {
        if (active) {
          setSlots(r);
          setDay(localDay(r.slots[0] || new Date().toISOString()));
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [projectId, proId, meeting?.id, attempt]);
  const days = [...new Set(slots?.slots.map(localDay) || [])];
  return (
    <dialog
      ref={dialog}
      className="call-scheduler"
      aria-labelledby="call-schedule-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <header>
        <span className="meeting-icon">
          <CalendarPlus size={25} />
        </span>
        <button
          type="button"
          className="secondary"
          aria-label="Close call scheduler"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <h2 id="call-schedule-title">
        {meeting ? "Propose a new time" : "Schedule a call"}
      </h2>
      <p className="meeting-context">
        <strong>
          {data.user.role === "pro"
            ? meeting?.customerName || project?.customerName || "Customer"
            : profile?.business || meeting?.business || "Professional"}
        </strong>
        <span>{project?.title || meeting?.title}</span>
      </p>
      <p>
        A {CALL_MINUTES}-minute call. The other person confirms your request.{" "}
        {meeting?.status === "confirmed" &&
          "Your current confirmed time stays reserved until a new time is accepted."}
      </p>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {!slots ? (
        <div>
          {!error ? (
            <p role="status">Loading available times…</p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError("");
                setAttempt((n) => n + 1);
              }}
            >
              Retry availability
            </button>
          )}
        </div>
      ) : !days.length ? (
        <div className="meeting-no-slots">
          <p>
            No open call times in the next 21 days. Ask the professional to
            update their work schedule or discuss another time in Messages.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
          >
            Refresh availability
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!time || busy) return;
            setBusy(true);
            setError("");
            void request(
              meeting
                ? `/call-meetings/${meeting.id}/actions`
                : "/call-meetings",
              meeting
                ? {
                    type: "reschedule",
                    startsAt: time,
                    expectedVersion: meeting.version,
                  }
                : {
                    id: requestId.current,
                    projectId,
                    proId,
                    startsAt: time,
                    mode,
                  },
            )
              .then(() => {
                changed();
                onDone();
              })
              .catch((e) => {
                if (
                  meeting &&
                  /This meeting (changed|is closed)/.test(e.message)
                ) {
                  setStale(true);
                  setError(
                    "This meeting changed. Close this window and review the latest meeting before proposing another time.",
                  );
                  changed();
                } else {
                  setError(e.message);
                  setTime("");
                  setAttempt((n) => n + 1);
                }
              })
              .finally(() => setBusy(false));
          }}
        >
          <fieldset disabled={busy || stale}>
            {!meeting && (
              <div className="meeting-mode" role="group" aria-label="Call type">
                {(["video", "audio"] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    className="secondary"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    {m === "video" ? <Video size={17} /> : <Phone size={17} />}{" "}
                    {m === "video" ? "Video call" : "Audio call"}
                  </button>
                ))}
              </div>
            )}
            <label>
              Choose a date
              <select
                value={day}
                onChange={(e) => {
                  setDay(e.target.value);
                  setTime("");
                }}
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {new Date(
                      slots.slots.find((s) => localDay(s) === d)!,
                    ).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </option>
                ))}
              </select>
            </label>
            <p className="meeting-zone">
              Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              Professional’s work schedule: {slots.timeZone}.
            </p>
            <div
              className="meeting-slots"
              role="group"
              aria-label="Available call times"
            >
              {slots.slots
                .filter((s) => localDay(s) === day)
                .map((s) => (
                  <button
                    type="button"
                    key={s}
                    className="secondary"
                    aria-pressed={time === s}
                    onClick={() => setTime(s)}
                  >
                    {new Date(s).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
            </div>
            <div className="actions">
              <button disabled={!time}>
                {busy
                  ? "Sending…"
                  : meeting
                    ? "Propose new time"
                    : "Request meeting"}
              </button>
              <button type="button" className="secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </dialog>
  );
}
export function CallMeetings({
  projectId,
  conversationProId,
  compact = false,
}: {
  projectId?: string;
  conversationProId?: string;
  compact?: boolean;
}) {
  const { data, go, id } = useWorkspace();
  const [rows, setRows] = useState<CallMeeting[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [editing, setEditing] = useState<CallMeeting | null>(null);
  const mounted = useRef(true),
    targeted = useRef("");
  useEffect(() => {
    if (!id || targeted.current === id) return;
    const card = document.getElementById("meeting-" + id);
    if (card) {
      targeted.current = id;
      card.focus({ preventScroll: true });
      card.scrollIntoView({ block: "nearest" });
    }
  }, [id, rows]);
  const refresh = async () => {
    try {
      const r = await request<CallMeeting[]>("/call-meetings");
      if (mounted.current) {
        setRows(r);
        setError("");
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Could not load meetings.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      await refresh();
      pending = false;
    };
    void load();
    const timer = setInterval(() => void load(), 10000);
    window.addEventListener("aplime:updates", load);
    window.addEventListener("aplime:meetings", load);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("aplime:updates", load);
      window.removeEventListener("aplime:meetings", load);
    };
  }, [data.user.id]);
  const shown = rows
    .filter(
      (m) =>
        (!projectId || m.projectId === projectId) &&
        (!conversationProId || m.proId === conversationProId) &&
        (!compact || ["requested", "confirmed"].includes(m.status)),
    )
    .sort(
      (a, b) =>
        Number(["requested", "confirmed"].includes(b.status)) -
          Number(["requested", "confirmed"].includes(a.status)) ||
        Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );
  const act = async (m: CallMeeting, body: object) => {
    setBusy(m.id);
    setError("");
    try {
      await request(`/call-meetings/${m.id}/actions`, {
        ...body,
        expectedVersion: m.version,
      });
      changed();
      await refresh();
    } catch (e) {
      await refresh().catch(() => {});
      setError(e instanceof Error ? e.message : "Could not update meeting.");
    } finally {
      setBusy("");
    }
  };
  if (compact && !shown.length && !error && !loading) return null;
  return (
    <section
      className={"call-meetings" + (compact ? " compact" : "")}
      aria-label="Call meetings"
    >
      <div className="meeting-section-heading">
        <h2>
          <CalendarDays size={21} />
          Call meetings
        </h2>
        <button
          type="button"
          className="text-button"
          aria-label="Refresh call meetings"
          disabled={!!busy}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading call meetings…</p>}
      {!loading && !shown.length && !error && (
        <p className="meeting-empty">
          No calls scheduled. Choose Schedule call on a professional’s project
          card to get started.
        </p>
      )}
      <div className="meeting-list">
        {shown.map((m) => {
          const active = ["requested", "confirmed"].includes(m.status),
            awaiting = !!m.proposedAt && m.proposedBy !== data.user.id,
            proposalExpired =
              !!m.proposedAt && Date.parse(m.proposedAt) <= Date.now(),
            ended = Date.parse(m.startsAt) + CALL_MINUTES * 60000 <= Date.now();
          return (
            <article
              key={m.id}
              id={"meeting-" + m.id}
              tabIndex={-1}
              className={"meeting-card" + (m.id === id ? " highlighted" : "")}
            >
              <div className="meeting-card-heading">
                <span className="meeting-icon">
                  {m.mode === "video" ? (
                    <Video size={20} />
                  ) : (
                    <Phone size={20} />
                  )}
                </span>
                <div>
                  <h3>
                    {data.user.role === "customer"
                      ? m.business
                      : m.customerName}
                  </h3>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => go("project", m.projectId)}
                  >
                    {m.title}
                  </button>
                </div>
                <Badge>{m.status}</Badge>
              </div>
              <p className="meeting-date">
                <CalendarDays size={16} />
                {when(m.startsAt)} · {CALL_MINUTES} min · {m.mode} call
              </p>
              {m.proposedAt && (
                <p className="meeting-proposal">
                  {m.status === "confirmed"
                    ? "Proposed new time: "
                    : "Requested time: "}
                  <strong>{when(m.proposedAt)}</strong>
                  {m.proposedBy === data.user.id
                    ? " · Waiting for confirmation"
                    : " · Your response needed"}
                </p>
              )}
              {proposalExpired && (
                <p className="meeting-proposal">
                  This proposed time has passed. Choose a new time or decline
                  the proposal.
                </p>
              )}
              {m.note && <p>{m.note}</p>}
              <div className="actions">
                {active && awaiting && (
                  <>
                    <button
                      disabled={!!busy || proposalExpired}
                      onClick={() =>
                        void act(m, { type: "respond", accept: true })
                      }
                    >
                      <Check size={16} />
                      Confirm{" "}
                      {m.status === "confirmed" ? "new time" : "meeting"}
                    </button>
                    <button
                      className="secondary"
                      disabled={!!busy}
                      onClick={() =>
                        void act(m, { type: "respond", accept: false })
                      }
                    >
                      Decline{" "}
                      {m.status === "confirmed" ? "new time" : "request"}
                    </button>
                  </>
                )}
                {callCanJoin(m) && (
                  <button
                    disabled={!!busy}
                    onClick={() => {
                      setBusy(m.id);
                      void request(`/call-meetings/${m.id}/join`, {})
                        .then((r) => openExternal(r.url))
                        .catch((e) => setError(e.message))
                        .finally(() => setBusy(""));
                    }}
                  >
                    {m.mode === "video" ? (
                      <Video size={16} />
                    ) : (
                      <Phone size={16} />
                    )}
                    Join call
                  </button>
                )}
                {active && (!ended || m.status === "requested") && (
                  <button
                    className="secondary"
                    disabled={!!busy}
                    onClick={() => setEditing(m)}
                  >
                    <CalendarPlus size={16} />
                    Change time
                  </button>
                )}
                {m.status === "confirmed" && ended && (
                  <button
                    className="secondary"
                    disabled={!!busy}
                    onClick={() => void act(m, { type: "complete" })}
                  >
                    Mark complete
                  </button>
                )}
                {active && (
                  <button
                    className="text-button meeting-cancel"
                    disabled={!!busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Cancel this call meeting? The other participant will be notified.",
                        )
                      )
                        void act(m, { type: "cancel" });
                    }}
                  >
                    <XCircle size={16} />
                    Cancel meeting
                  </button>
                )}
              </div>
              {m.status === "confirmed" && !ended && !callCanJoin(m) && (
                <small>Join opens 15 minutes before the meeting.</small>
              )}
            </article>
          );
        })}
      </div>
      {editing && (
        <CallScheduler
          projectId={editing.projectId}
          proId={editing.proId}
          meeting={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </section>
  );
}
