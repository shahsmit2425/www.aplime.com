import { auth } from "./auth.js";
import { fallbackConfig } from "../shared/config.js";
function watchLegacyNotifications(
  onChange: () => void,
  onStatus: (connected: boolean) => void,
) {
  let stopped = false,
    controller: AbortController | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    failures = 0;
  const owner = auth().currentUser;
  async function connect() {
    if (stopped || !owner || auth().currentUser !== owner) return;
    controller = new AbortController();
    const currentController = controller;
    const timeout = setTimeout(() => currentController.abort(), 75000);
    try {
      const token = await owner!.getIdToken();
      if (stopped) return;
      const base = (window.__CONFIG__ || fallbackConfig).apiUrl;
      const response = await fetch(base + "/api/notifications/stream", {
        headers: { Authorization: "Bearer " + token },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("Stream unavailable");
      onStatus(true);
      failures = 0;
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      while (!stopped) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        let end: number;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (event.includes("data: changed")) onChange();
        }
      }
    } catch {
      failures++;
    } finally {
      clearTimeout(timeout);
      if (!stopped) {
        onStatus(false);
        retry = setTimeout(
          () => void connect(),
          Math.min(30000, 1000 * 2 ** Math.min(failures, 5)),
        );
      }
    }
  }
  void connect();
  return () => {
    stopped = true;
    controller?.abort();
    clearTimeout(retry);
  };
}

export function watchNotifications(
  onChange: () => void,
  onStatus: (connected: boolean) => void,
) {
  const owner = auth().currentUser;
  let stopped = false,
    ws: WebSocket | undefined,
    legacy: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined,
    changed: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const refresh = () => {
    clearTimeout(changed);
    changed = setTimeout(() => {
      if (!stopped) onChange();
    }, 100);
  };
  const reconcile = setInterval(refresh, 30000);
  const fallback = () => {
    if (!stopped && !legacy)
      legacy = watchLegacyNotifications(refresh, onStatus);
  };
  async function connect() {
    if (stopped || !owner || auth().currentUser !== owner) return;
    try {
      const token = await owner.getIdToken();
      const base = (window.__CONFIG__ || fallbackConfig).apiUrl;
      const response = await fetch(base + "/api/realtime/ticket", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(10000),
        ]),
      });
      if (!response.ok) throw new Error("Live connection unavailable");
      const { ticket } = await response.json();
      if (stopped) return;
      ws = new WebSocket(base.replace(/^http/, "ws") + "/api/realtime");
      const socket = ws;
      let ready = false;
      timer = setTimeout(() => {
        socket.close();
        fallback();
      }, 10000);
      socket.onopen = () => socket.send(JSON.stringify({ ticket }));
      socket.onmessage = (event) => {
        if (stopped) return;
        try {
          if (JSON.parse(event.data).type === "changed") {
            ready = true;
            clearTimeout(timer);
            onStatus(true);
            refresh();
          }
        } catch {
          socket.close();
        }
      };
      socket.onclose = () => {
        clearTimeout(timer);
        if (stopped) return;
        onStatus(false);
        if (ready && !legacy) timer = setTimeout(() => void connect(), 1000);
        else fallback();
      };
    } catch {
      fallback();
    }
  }
  void connect();
  return () => {
    stopped = true;
    controller.abort();
    ws?.close();
    legacy?.();
    clearInterval(reconcile);
    clearTimeout(timer);
    clearTimeout(changed);
  };
}
