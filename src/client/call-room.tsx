import { useEffect, useRef, useState } from "react";
import Daily, {
  type DailyCall,
  type DailyParticipant,
} from "@daily-co/daily-js";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Pin,
  SwitchCamera,
  PhoneOff,
} from "lucide-react";

function Participant({ participant }: { participant: DailyParticipant }) {
  const video = useRef<HTMLVideoElement>(null),
    audio = useRef<HTMLAudioElement>(null);
  const [needsPlayback, setNeedsPlayback] = useState(false);
  const videoTrack = participant.tracks.video.persistentTrack;
  const audioTrack = participant.tracks.audio.persistentTrack;
  useEffect(() => {
    const element = video.current;
    if (!element || !videoTrack) return;
    element.srcObject = new MediaStream([videoTrack]);
    void element.play().catch(() => {});
    return () => {
      element.srcObject = null;
    };
  }, [videoTrack]);
  useEffect(() => {
    const element = audio.current;
    if (!element || !audioTrack || participant.local) return;
    element.srcObject = new MediaStream([audioTrack]);
    void element.play().catch(() => setNeedsPlayback(true));
    return () => {
      element.srcObject = null;
    };
  }, [audioTrack, participant.local]);
  const visible = ["playable", "sendable"].includes(
    participant.tracks.video.state,
  );
  return (
    <article className="call-person">
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        style={{
          visibility: visible ? "visible" : "hidden",
          transform: participant.local ? "scaleX(-1)" : undefined,
        }}
      />
      {!visible && (
        <div className="call-camera-off">
          <VideoOff size={28} />
          <span>Camera off</span>
        </div>
      )}
      {!participant.local && <audio ref={audio} autoPlay />}
      <span className="call-person-name">
        {participant.local
          ? "You"
          : participant.user_name || "Your call partner"}
      </span>
      {needsPlayback && (
        <button
          className="call-play-audio"
          onClick={() =>
            void audio.current
              ?.play()
              .then(() => setNeedsPlayback(false))
              .catch(() => setNeedsPlayback(true))
          }
        >
          Tap to hear audio
        </button>
      )}
    </article>
  );
}

export default function CallRoom({
  url,
  endsAt,
  audioOnly,
  onClose,
}: {
  url: string;
  endsAt: number;
  audioOnly: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    call = useRef<DailyCall | null>(null);
  const [participants, setParticipants] = useState<DailyParticipant[]>([]);
  const [status, setStatus] = useState<
    "ready" | "joining" | "joined" | "ended"
  >("ready");
  const [error, setError] = useState(""),
    [pinned, setPinned] = useState(false),
    [now, setNow] = useState(Date.now());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive.current = false;
      clearInterval(tick);
      void call.current?.destroy();
      call.current = null;
    };
  }, []);
  useEffect(() => {
    if (now < endsAt) return;
    setStatus("ended");
    void call.current?.leave();
  }, [now >= endsAt, endsAt]);
  const start = async () => {
    setStatus("joining");
    setError("");
    try {
      const parsed = new URL(url),
        token = parsed.searchParams.get("t");
      if (
        parsed.protocol !== "https:" ||
        !parsed.hostname.endsWith(".daily.co") ||
        !token
      )
        throw new Error("Invalid call link. Close and rejoin from Schedule.");
      parsed.search = "";
      const instance = Daily.createCallObject({
        dailyConfig: { avoidEval: true },
      });
      call.current = instance;
      const update = () => {
        if (alive.current)
          setParticipants(Object.values(instance.participants()));
      };
      instance
        .on("participant-joined", update)
        .on("participant-updated", update)
        .on("participant-left", update)
        .on("track-started", update)
        .on("track-stopped", update);
      instance.on("left-meeting", () => {
        if (alive.current) setStatus("ended");
      });
      instance.on("error", () => {
        if (alive.current)
          setError("The call was interrupted. Close and rejoin from Schedule.");
      });
      instance.on("camera-error", () => {
        if (alive.current)
          setError(
            "Allow microphone and camera access in your device settings. You can continue with audio if your microphone is available.",
          );
      });
      await instance.join({
        url: parsed.toString(),
        token,
        startVideoOff: audioOnly,
      });
      if (alive.current) {
        setStatus("joined");
        update();
      }
    } catch {
      if (alive.current) {
        setError(
          "Could not join. Check your connection and microphone/camera permissions, then close and try again.",
        );
        setStatus("ended");
      }
    }
  };
  const local = participants.find((p) => p.local);
  const sorted = [...participants].sort((a, b) =>
    pinned
      ? Number(b.local) - Number(a.local)
      : Number(a.local) - Number(b.local),
  );
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const control = async (action: () => unknown) => {
    try {
      await action();
    } catch {
      setError(
        "Could not change that setting. Check device permissions and try again.",
      );
    }
  };
  return (
    <dialog
      ref={dialog}
      className="aplime-call-room"
      aria-labelledby="call-room-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <h2 id="call-room-title">
            {audioOnly ? "Audio call" : "Video call"}
          </h2>
          <span>
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")} remaining
          </span>
        </div>
        <button onClick={onClose} aria-label="Leave call">
          <PhoneOff size={20} /> Leave
        </button>
      </header>
      {error && (
        <p role="alert" className="call-error">
          {error}
        </p>
      )}
      {status === "ready" && (
        <div className="call-lobby">
          <h3>Ready to connect?</h3>
          <p>
            Your microphone{!audioOnly && " and camera"} will turn on when you
            join.
          </p>
          <button onClick={() => void start()} disabled={!remaining}>
            Join {audioOnly ? "audio" : "video"} call
          </button>
        </div>
      )}
      {status === "joining" && <p role="status">Connecting securely…</p>}
      {status === "ended" && (
        <div className="call-lobby">
          <h3>Call ended</h3>
          <button onClick={onClose}>Back to Schedule</button>
        </div>
      )}
      {status === "joined" && (
        <>
          <div className={"call-people" + (pinned ? " self-pinned" : "")}>
            {sorted.map((p) => (
              <Participant key={p.session_id} participant={p} />
            ))}
            {participants.length < 2 && (
              <p className="call-waiting">Waiting for your call partner…</p>
            )}
          </div>
          <footer>
            <button
              aria-pressed={!local?.audio}
              onClick={() =>
                void control(() => call.current?.setLocalAudio(!local?.audio))
              }
            >
              {local?.audio ? <Mic /> : <MicOff />}
              <span>{local?.audio ? "Mute" : "Unmute"}</span>
            </button>
            <button
              aria-pressed={!!local?.video}
              onClick={() =>
                void control(() => call.current?.setLocalVideo(!local?.video))
              }
            >
              {local?.video ? <Video /> : <VideoOff />}
              <span>Camera</span>
            </button>
            <button aria-pressed={pinned} onClick={() => setPinned((v) => !v)}>
              <Pin />
              <span>{pinned ? "Unpin yourself" : "Pin yourself"}</span>
            </button>
            <button
              disabled={!local?.video}
              onClick={() => void control(() => call.current?.cycleCamera())}
            >
              <SwitchCamera />
              <span>Flip camera</span>
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}
