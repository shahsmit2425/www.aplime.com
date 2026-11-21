import { useEffect, useRef, useState } from "react";
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
  // How the icon moves, and what bursts out behind it.
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
  confirmed: {
    icon: Handshake,
    motion: "shake",
    burst: "sparks",
    tone: "joy",
  },
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
  "review-received": {
    icon: Star,
    motion: "spin",
    burst: "stars",
    tone: "warm",
  },
  "reply-sent": { icon: MessageSquareReply, motion: "pop", tone: "brand" },
  "reply-received": {
    icon: MessageSquareReply,
    motion: "drop",
    tone: "brand",
  },
  verified: { icon: BadgeCheck, motion: "stamp", burst: "sparks", tone: "joy" },
  approved: { icon: Award, motion: "bounce", burst: "confetti", tone: "joy" },
  submitted: { icon: Send, motion: "fly", tone: "brand" },
  thanks: { icon: Heart, motion: "beat", burst: "hearts", tone: "love" },
  support: { icon: LifeBuoy, motion: "turn", tone: "brand" },
};
const bursts = { confetti: 14, hearts: 6, stars: 6, sparks: 8 };
export function MomentArt({
  kind,
  size = 30,
}: {
  kind: MomentKind;
  size?: number;
}) {
  const { icon: Icon, motion, burst, tone } = art[kind];
  return (
    <span className={`moment-art tone-${tone}`} aria-hidden="true">
      {burst && (
        <span className={`moment-burst burst-${burst}`}>
          {Array.from({ length: bursts[burst] }, (_, i) =>
            burst === "hearts" ? (
              <Heart key={i} size={12} fill="currentColor" />
            ) : burst === "stars" ? (
              <Star key={i} size={12} fill="currentColor" />
            ) : (
              <i key={i} />
            ),
          )}
        </span>
      )}
      <span className={`moment-icon motion-${motion}`}>
        <Icon size={size} strokeWidth={1.9} />
      </span>
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
export function Moments({
  onAction,
}: {
  onAction: (page: string, id?: string) => void;
}) {
  const [queue, setQueue] = useState<Moment[]>([]);
  const [held, setHeld] = useState(false);
  const shown = useRef(new Set<string>());
  const current = queue[0];
  const lively = current && (!!art[current.kind].burst || !!current.action);
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
  const dismiss = () => {
    setHeld(false);
    setQueue((q) => q.slice(1));
  };
  useEffect(() => {
    if (!current || held) return;
    const timer = setTimeout(dismiss, lively ? 9000 : 6000);
    return () => clearTimeout(timer);
  }, [current, held, lively]);
  useEffect(() => {
    if (!current) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]"))
        dismiss();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [current]);
  if (!current) return null;
  return (
    <aside
      key={current.key}
      className={
        `moment tone-${art[current.kind].tone}` +
        (lively ? " moment-lively" : "") +
        (held ? " moment-held" : "")
      }
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <MomentArt kind={current.kind} />
      <div className="moment-copy">
        <strong>{current.title}</strong>
        <p>{current.body}</p>
        {current.action && (
          <button
            type="button"
            onClick={() => {
              const { page, id } = current.action!;
              dismiss();
              onAction(page, id);
            }}
          >
            {current.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        className="icon-button moment-close"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <X size={18} />
      </button>
      <span className="moment-timer" aria-hidden="true" />
    </aside>
  );
}
