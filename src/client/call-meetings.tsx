import { T } from "../shared/language.js";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  callIsActive,
  CALL_MINUTES,
  type CallMeeting,
  type CallSlots,
} from "../shared/meetings.js";
import { request } from "./api.js";
import { useWorkspace } from "./workspace.js";
import { useMeetings } from "./meeting-state.js";
import { Badge } from "./ui.js";
const changed = () => window.dispatchEvent(new Event("aplime:meetings"));
const when = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
const dayFormatter = new Intl.DateTimeFormat("en-CA");
const localDay = (s: string) => dayFormatter.format(new Date(s));
const CallRoom = lazy(() => import("./call-room.js"));
export function ScheduleCallButton({
  projectId,
  proId,
  label = "Schedule call",
  customerId,
  disabled = false,
}: {
  projectId: string;
  proId: string;
  label?: string;
  customerId?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data, go } = useWorkspace();
  const { rows, loading, error, now, refresh } = useMeetings();
  const customer =
    customerId ||
    (data.user.role === "customer"
      ? data.user.id
      : [...data.projects, ...data.leads].find((p) => p.id === projectId)
          ?.customerId);
  const existing = rows.find(
    (m) =>
      m.proId === proId &&
      (customer ? m.customerId === customer : m.projectId === projectId) &&
      callIsActive(m, now),
  );
  return (
    <>
      <button
        type="button"
        className="secondary"
        disabled={disabled || loading}
        onClick={() => {
          if (error) void refresh();
          else if (existing) go("schedule", existing.id);
          else setOpen(true);
        }}
      >
        <CalendarPlus size={16} />
        {loading
          ? "Loading meeting…"
          : error
            ? "Retry meetings"
            : existing
              ? "Manage meeting"
              : label}
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
    [instant, setInstant] = useState(false),
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
  const groups = useMemo(() => {
    const result = new Map<
      string,
      { label: string; times: { value: string; label: string }[] }
    >();
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeLabel = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    for (const value of slots?.slots || []) {
      const date = new Date(value),
        key = localDay(value);
      if (!result.has(key))
        result.set(key, { label: dateLabel.format(date), times: [] });
      result.get(key)!.times.push({ value, label: timeLabel.format(date) });
    }
    return result;
  }, [slots]);
  const days = [...groups.keys()];
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
      {!meeting && data.user.role === "customer" && (
        <div
          className="meeting-request-kind"
          role="group"
          aria-label="When to call"
        >
          <button
            type="button"
            className="secondary"
            disabled={busy}
            aria-pressed={!instant}
            onClick={() => setInstant(false)}
          >
            Choose a time
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            aria-pressed={instant}
            onClick={() => {
              setInstant(true);
              setMode("video");
            }}
          >
            Urgent video request
          </button>
        </div>
      )}
      {instant && (
        <p className="meeting-proposal">
          Ask this professional to call now. They must accept first, and may be
          unavailable. The 10-minute call starts when accepted. You can cancel
          or choose a later time. For immediate danger, contact emergency
          services.
        </p>
      )}
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
      {stale && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onDone();
          }}
        >
          Review meetings
        </button>
      )}
      {!slots && !instant ? (
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
      ) : !days.length && !instant ? (
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
            if ((!time && !instant) || busy) return;
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
                    ...(instant
                      ? { instant: true, mode: "video" }
                      : { startsAt: time, mode }),
                  },
            )
              .then(() => {
                changed();
                onDone();
              })
              .catch((e) => {
                if (/already have an active meeting/.test(e.message)) {
                  setStale(true);
                  setError(e.message);
                  changed();
                } else if (
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
            {!meeting && !instant && (
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
            {!instant && (
              <>
                <p>
                  <strong>Choose a date</strong>
                </p>
                <div
                  className="meeting-days"
                  role="group"
                  aria-label="Available dates"
                >
                  {days.map((d) => (
                    <button
                      type="button"
                      className="secondary"
                      key={d}
                      aria-pressed={day === d}
                      onClick={() => {
                        setDay(d);
                        setTime("");
                      }}
                    >
                      {groups.get(d)!.label}
                    </button>
                  ))}
                </div>
                <p className="meeting-zone">
                  Times shown in{" "}
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}.
                  Professional’s work schedule: {slots?.timeZone}.
                </p>
                <div
                  className="meeting-slots"
                  role="group"
                  aria-label="Available call times"
                >
                  {(groups.get(day)?.times || []).map(({ value: s, label }) => (
                    <button
                      type="button"
                      key={s}
                      className="secondary"
                      aria-pressed={time === s}
                      onClick={() => setTime(s)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {time && !instant && <p role="status">Selected: {when(time)}</p>}
            <div className="actions">
              <button disabled={!time && !instant}>
                {busy
                  ? "Sending…"
                  : meeting
                    ? "Propose new time"
                    : instant
                      ? "Send urgent request"
                      : "Request meeting"}
              </button>
              <button type="button" className="secondary" onClick={onClose}>
                <T>{"Cancel"}</T>{" "}
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
  const { rows, loading, error: loadError, refresh, now } = useMeetings();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [editing, setEditing] = useState<CallMeeting | null>(null);
  const [joining, setJoining] = useState<{
    url: string;
    endsAt: number;
    audioOnly: boolean;
  } | null>(null);
  const targeted = useRef("");
  useEffect(() => {
    if (!id || targeted.current === id) return;
    const card = document.getElementById("meeting-" + id);
    if (card) {
      targeted.current = id;
      card.focus({ preventScroll: true });
      card.scrollIntoView({ block: "nearest" });
    }
  }, [id, rows]);
  const shown = rows
    .filter(
      (m) =>
        (!projectId || m.projectId === projectId) &&
        (!conversationProId || m.proId === conversationProId) &&
        (!compact || callIsActive(m, now)),
    )
    .sort(
      (a, b) =>
        Number(callIsActive(b, now)) - Number(callIsActive(a, now)) ||
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
  if (compact && !shown.length && !error && !loadError && !loading) return null;
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
      {(error || loadError) && (
        <p role="alert" className="alert error">
          {error || loadError}
        </p>
      )}
      {loading && <p role="status">Loading call meetings…</p>}
      {!loading && !shown.length && !error && !loadError && (
        <p className="meeting-empty">
          No calls scheduled. Choose Schedule call on a professional’s project
          card to get started.
        </p>
      )}
      <div className="meeting-list">
        {shown.map((m) => {
          const active = callIsActive(m, now),
            awaiting = !!m.proposedAt && m.proposedBy !== data.user.id,
            proposalExpired =
              !m.instant && !!m.proposedAt && Date.parse(m.proposedAt) <= now,
            ended = Date.parse(m.startsAt) + CALL_MINUTES * 60000 <= now,
            status =
              !active && m.status === "confirmed"
                ? "completed"
                : !active && m.status === "requested"
                  ? "cancelled"
                  : m.status;
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
                <Badge>{status}</Badge>
              </div>
              <p className="meeting-date">
                <CalendarDays size={16} />
                {m.instant && m.status === "requested"
                  ? "Urgent request · Starts when accepted"
                  : when(m.startsAt)}{" "}
                · {CALL_MINUTES} min · {m.mode} call
              </p>
              {active && m.proposedAt && (
                <p className="meeting-proposal">
                  {m.status === "confirmed"
                    ? "Proposed new time: "
                    : "Requested time: "}
                  <strong>
                    {m.instant
                      ? "As soon as you are ready"
                      : when(m.proposedAt)}
                  </strong>
                  {m.proposedBy === data.user.id
                    ? " · Waiting for confirmation"
                    : " · Your response needed"}
                </p>
              )}
              {active && proposalExpired && (
                <p className="meeting-proposal">
                  This proposed time has passed. The request stays open. Choose
                  a new time or decline the proposal.
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
                      {m.instant
                        ? "Accept — start 10-minute call"
                        : `Confirm ${m.status === "confirmed" ? "new time" : "meeting"}`}
                    </button>
                    <button
                      className="secondary"
                      disabled={!!busy}
                      onClick={() =>
                        void act(m, { type: "respond", accept: false })
                      }
                    >
                      <T>{"Decline"}</T>{" "}
                      {m.status === "confirmed" ? "new time" : "request"}
                    </button>
                  </>
                )}
                {callCanJoin(m, now) && (
                  <button
                    disabled={!!busy}
                    onClick={() => {
                      setBusy(m.id);
                      void request(`/call-meetings/${m.id}/join`, {})
                        .then((r) =>
                          setJoining({
                            url: r.url,
                            endsAt: r.endsAt,
                            audioOnly: r.mode === "audio",
                          }),
                        )
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
                {active &&
                  (m.status === "requested" ||
                    now < Date.parse(m.startsAt)) && (
                    <button
                      className="secondary"
                      disabled={!!busy}
                      onClick={() => setEditing(m)}
                    >
                      <CalendarPlus size={16} />
                      Change time
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
              {!active &&
                !["completed", "cancelled", "disputed"].includes(
                  [...data.projects, ...data.leads].find(
                    (p) => p.id === m.projectId,
                  )?.status || "completed",
                ) && (
                  <ScheduleCallButton
                    projectId={m.projectId}
                    proId={m.proId}
                    customerId={m.customerId}
                    label="Schedule another call"
                  />
                )}
              {m.status === "confirmed" && !ended && !callCanJoin(m, now) && (
                <small>Join opens at the scheduled start time.</small>
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
      {joining && (
        <Suspense fallback={<p role="status">Opening call controls…</p>}>
          <CallRoom {...joining} onClose={() => setJoining(null)} />
        </Suspense>
      )}
    </section>
  );
}
