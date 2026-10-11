import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { CallMeeting } from "../shared/meetings.js";
import { request } from "./api.js";

type MeetingState = {
  rows: CallMeeting[];
  loading: boolean;
  error: string;
  now: number;
  refresh: () => Promise<void>;
};
const Context = createContext<MeetingState | null>(null);
export function useMeetings() {
  const state = useContext(Context);
  if (!state) throw new Error("Meeting state unavailable");
  return state;
}
// One subscription per signed-in workspace, shared by every card and chat.
export function MeetingProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [state, setState] = useState({
    rows: [] as CallMeeting[],
    loading: true,
    error: "",
  });
  const [now, setNow] = useState(Date.now());
  const [refresh, setRefresh] = useState<() => Promise<void>>(
    () => async () => {},
  );
  useEffect(() => {
    let active = true,
      pending = false;
    setState({ rows: [], loading: true, error: "" });
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const rows = await request<CallMeeting[]>("/call-meetings");
        if (active) setState({ rows, loading: false, error: "" });
      } catch (e) {
        if (active)
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : "Could not load meetings.",
          }));
      } finally {
        pending = false;
      }
    };
    setRefresh(() => load);
    void load();
    const poll = setInterval(() => void load(), 10000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("aplime:updates", load);
    window.addEventListener("aplime:meetings", load);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(clock);
      window.removeEventListener("aplime:updates", load);
      window.removeEventListener("aplime:meetings", load);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [userId]);
  return (
    <Context.Provider value={{ ...state, now, refresh }}>
      {children}
    </Context.Provider>
  );
}
