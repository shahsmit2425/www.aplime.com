import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Award,
  BadgeCheck,
  CalendarCheck,
  CircleCheck,
  CirclePause,
  CircleSlash,
  Hammer,
  Handshake,
  Heart,
  LifeBuoy,
  Mail,
  MessageSquareReply,
  PartyPopper,
  Play,
  Rocket,
  Send,
  Star,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Moment, MomentKind } from "./moment-events.js";
type Art = {
  icon: LucideIcon;
  // How the icon moves, and what fills the screen behind a celebration.
  motion: string;
  burst?: "confetti" | "hearts" | "stars" | "sparks";
  tone: "brand" | "joy" | "love" | "warm" | "calm";
};
const art: Record<MomentKind, Art> = {
  welcome: { icon: PartyPopper, motion: "pop", burst: "confetti", tone: "joy" },
  published: { icon: Rocket, motion: "launch", burst: "sparks", tone: "brand" },
  "estimate-sent": { icon: Send, motion: "fly", tone: "brand" },
  "estimate-received": { icon: Mail, motion: "drop", tone: "brand" },
  selected: { icon: Handshake, motion: "shake", tone: "brand" },
  chosen: { icon: PartyPopper, motion: "pop", burst: "confetti", tone: "joy" },
  confirmed: { icon: Handshake, motion: "shake", tone: "joy" },
  appointment: { icon: CalendarCheck, motion: "flip", tone: "brand" },
  started: { icon: Hammer, motion: "swing", tone: "warm" },
  resumed: { icon: Play, motion: "nudge", tone: "brand" },
  "wrap-up": { icon: CircleCheck, motion: "pop", tone: "brand" },
  completed: { icon: Trophy, motion: "bounce", burst: "confetti", tone: "joy" },
  cancelled: { icon: CircleSlash, motion: "settle", tone: "calm" },
  paused: { icon: CirclePause, motion: "settle", tone: "calm" },
  "review-thanks": {
    icon: Heart,
    motion: "beat",
    burst: "hearts",
    tone: "love",
  },
  "review-received": { icon: Star, motion: "spin", tone: "warm" },
  "reply-sent": { icon: MessageSquareReply, motion: "pop", tone: "brand" },
  "reply-received": {
    icon: MessageSquareReply,
    motion: "drop",
    tone: "brand",
  },
  verified: { icon: BadgeCheck, motion: "stamp", burst: "stars", tone: "joy" },
  approved: { icon: Award, motion: "bounce", burst: "confetti", tone: "joy" },
  submitted: { icon: Send, motion: "fly", tone: "brand" },
  thanks: { icon: Heart, motion: "beat", tone: "love" },
  support: { icon: LifeBuoy, motion: "turn", tone: "brand" },
};
// The emblem: a tinted disc, the event's icon and its own entrance.
export function MomentArt({
  kind,
  size = 26,
}: {
  kind: MomentKind;
  size?: number;
}) {
  const { icon: Icon, motion, tone } = art[kind];
  return (
    <span className={`moment-art tone-${tone}`} aria-hidden="true">
      <span className={`moment-icon motion-${motion}`}>
        <Icon size={size} strokeWidth={2} />
      </span>
    </span>
  );
}
const pieces = { confetti: 44, hearts: 16, stars: 20, sparks: 18 };
const palette = ["#064bff", "#00b8ab", "#f5a400", "#e8457a", "#7a5cff"];
// Fills the screen behind a celebration. Positions derive from the index so
// every piece lands in the same place on each run.
function MomentSky({ burst }: { burst: keyof typeof pieces }) {
  return (
    <span className={`moment-sky sky-${burst}`} aria-hidden="true">
      {Array.from({ length: pieces[burst] }, (_, i) => {
        const style = {
          "--x": (i * 37 + 11) % 100,
          "--y": (i * 53 + 7) % 100,
          "--turn": (i * 47) % 360,
          "--delay": (i % 9) * 0.11 + "s",
          "--pace": 2.2 + (i % 5) * 0.4 + "s",
          "--scale": 0.7 + (i % 4) * 0.2,
          "--color": palette[i % palette.length],
        } as CSSProperties;
        return burst === "hearts" ? (
          <Heart key={i} size={22} fill="currentColor" style={style} />
        ) : burst === "stars" ? (
          <Star key={i} size={20} fill="currentColor" style={style} />
        ) : (
          <i key={i} style={style} />
        );
      })}
    </span>
  );
}
// Moments raised before the host is on screen (for example while an account
// is being created) wait here until it mounts.
const waiting: Moment[] = [];
export function celebrate(moment: Moment) {
  waiting.push(moment);
  window.dispatchEvent(new Event("aplime:moment"));
}
// A celebration takes the whole screen, but never away from someone who is
// typing or still working in a dialog: they get the quiet banner instead.
const occupied = () =>
  !!document.querySelector("dialog[open]") ||
  !!document.activeElement?.closest(
    "input, textarea, select, [contenteditable]",
  );
export function Moments({
  onAction,
}: {
  onAction: (page: string, id?: string) => void;
}) {
  const [queue, setQueue] = useState<Moment[]>([]);
  const [stage, setStage] = useState<{ key: string; spotlight: boolean }>();
  const [held, setHeld] = useState(false);
  const shown = useRef(new Set<string>());
  const dialog = useRef<HTMLDialogElement>(null);
  const current = queue[0];
  const ready = !!current && stage?.key === current.key;
  const spotlight = ready && stage.spotlight;
  const life = spotlight ? 10000 : current?.action ? 9000 : 6000;
  useEffect(() => {
    const collect = () => {
      const fresh = waiting.splice(0).filter((m) => {
        if (shown.current.has(m.key)) return false;
        shown.current.add(m.key);
        return true;
      });
      if (fresh.length) setQueue((q) => [...q, ...fresh]);
    };
    collect();
    window.addEventListener("aplime:moment", collect);
    return () => window.removeEventListener("aplime:moment", collect);
  }, []);
  // Chosen a beat late, once the dialog that caused the moment has closed.
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(
      () =>
        setStage({
          key: current.key,
          spotlight: !!art[current.kind].burst && !occupied(),
        }),
      250,
    );
    return () => clearTimeout(timer);
  }, [current]);
  const dismiss = () => {
    setHeld(false);
    setQueue((q) => q.slice(1));
  };
  useEffect(() => {
    if (!ready || held) return;
    const timer = setTimeout(dismiss, life);
    return () => clearTimeout(timer);
  }, [current, ready, held, life]);
  useEffect(() => {
    if (!ready) return;
    if (spotlight) {
      const previous = document.activeElement as HTMLElement | null;
      const element = dialog.current;
      element?.showModal();
      return () => {
        element?.close();
        if (previous?.isConnected) previous.focus();
      };
    }
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]"))
        dismiss();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [current, ready, spotlight]);
  if (!ready) return null;
  const { tone, burst } = art[current.kind];
  const act = current.action && (
    <button
      type="button"
      className="moment-action"
      onClick={() => {
        const { page, id } = current.action!;
        dismiss();
        onAction(page, id);
      }}
    >
      {current.action.label}
    </button>
  );
  if (spotlight)
    return (
      <dialog
        key={current.key}
        ref={dialog}
        className={
          `moment-spotlight tone-${tone}` + (held ? " moment-held" : "")
        }
        aria-labelledby="moment-title"
        aria-describedby="moment-body"
        onCancel={(e) => {
          e.preventDefault();
          dismiss();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dismiss();
        }}
        // Anyone reading with a keyboard keeps it until they close it.
        onKeyDown={() => setHeld(true)}
      >
        {burst && <MomentSky burst={burst} />}
        <div
          className="moment-card"
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
        >
          <MomentArt kind={current.kind} size={46} />
          <h2 id="moment-title">{current.title}</h2>
          <p id="moment-body">{current.body}</p>
          <div className="moment-card-actions">
            {act}
            <button
              type="button"
              className={act ? "secondary" : "moment-action"}
              onClick={dismiss}
            >
              {act ? "Not now" : "Continue"}
            </button>
          </div>
          <span className="moment-timer" aria-hidden="true" />
        </div>
      </dialog>
    );
  return (
    <aside
      key={current.key}
      className={
        `moment-banner tone-${tone}` +
        (act ? " with-action" : "") +
        (held ? " moment-held" : "")
      }
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <MomentArt kind={current.kind} size={22} />
      <div className="moment-copy">
        <strong>{current.title}</strong>
        <p>{current.body}</p>
      </div>
      {act}
      <button
        type="button"
        className="moment-close"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="16" pathLength="100" />
        </svg>
        <X size={16} />
      </button>
    </aside>
  );
}
