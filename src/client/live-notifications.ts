import { auth } from "./auth.js";
import { fallbackConfig } from "../shared/config.js";
export function watchNotifications(
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
