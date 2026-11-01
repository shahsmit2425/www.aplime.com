import { useEffect, useState, useRef } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { auth } from "./auth.js";
import { request } from "./api.js";

const optKey = "aplime:push-enabled";
const tokenKey = "aplime:push-token";
let registration: Promise<void> = Promise.resolve();
let signingOut = false;
function registerDevice(token: string, uid: string) {
  registration = registration
    .catch(() => {})
    .then(async () => {
      if (
        signingOut ||
        auth().currentUser?.uid !== uid ||
        localStorage.getItem(optKey) !== "yes"
      )
        return;
      await request("/push/devices", {
        token,
        platform: Capacitor.getPlatform(),
      });
      localStorage.setItem(tokenKey, token);
    });
  return registration;
}
async function syncDevice() {
  const uid = auth().currentUser?.uid;
  if (!uid || signingOut || localStorage.getItem(optKey) !== "yes") return;
  const permission = await FirebaseMessaging.checkPermissions();
  if (permission.receive !== "granted") return;
  const { token } = await FirebaseMessaging.getToken();
  await registerDevice(token, uid);
}
export async function disconnectPush() {
  if (!Capacitor.isNativePlatform()) return;
  signingOut = true;
  await registration.catch(() => {});
  const token = localStorage.getItem(tokenKey);
  // If offline, deleting the FCM token still invalidates the old destination
  // when Firebase becomes reachable. Payloads never contain private content.
  let removed = !token;
  try {
    if (token) await request("/push/devices/remove", { token });
    removed = true;
  } catch {}
  let invalidated = false;
  try {
    await FirebaseMessaging.deleteToken();
    invalidated = true;
  } catch {}
  await FirebaseMessaging.removeAllDeliveredNotifications().catch(() => {});
  if (!removed && !invalidated) {
    signingOut = false;
    throw new Error(
      "Connect to the internet to safely disconnect notifications before signing out.",
    );
  }
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(optKey);
}

export function NativePush({
  userId,
  go,
}: {
  userId: string;
  go: (page: string, id?: string) => void;
}) {
  const navigate = useRef(go);
  navigate.current = go;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    signingOut = false;
    let disposed = false;
    const handles: PluginListenerHandle[] = [];
    const keep = async (handle: Promise<PluginListenerHandle>) => {
      const h = await handle;
      if (disposed) await h.remove();
      else handles.push(h);
    };
    const sync = () => {
      void syncDevice().catch(() => {});
    };
    void keep(
      FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
        if (!disposed) void registerDevice(token, userId).catch(() => {});
      }),
    );
    void keep(
      FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
        const id = (
          event.notification.data as { notificationId?: unknown } | undefined
        )?.notificationId;
        if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) return;
        // Resolve targets through the authenticated API, never trust a push URL.
        void request<{ target_page: string; target_id: string | null }>(
          "/push/notifications/" + id,
        )
          .then((n) => {
            if (disposed || auth().currentUser?.uid !== userId) return;
            navigate.current(n.target_page, n.target_id || undefined);
            void request("/notifications/" + id + "/read", {}).catch(() => {});
          })
          .catch(() => {});
      }),
    );
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      disposed = true;
      handles.forEach((h) => void h.remove());
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [userId]);
  return null;
}

export function PushSettings() {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(optKey) === "yes",
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (!Capacitor.isNativePlatform()) return null;
  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      if (enabled) {
        await disconnectPush();
        signingOut = false;
        setEnabled(false);
      } else {
        const { receive } = await FirebaseMessaging.requestPermissions();
        if (receive !== "granted") {
          setMessage(
            "Allow notifications in your phone’s Settings for Aplime, then try again.",
          );
          return;
        }
        signingOut = false;
        localStorage.setItem(optKey, "yes");
        await syncDevice();
        setEnabled(true);
        setMessage("Notifications are enabled on this device.");
      }
    } catch {
      setMessage(
        "Could not update notifications. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Push notifications</h2>
      <p>
        Get alerts for messages, project updates and meetings when Aplime is
        closed. Private details stay inside the app.
      </p>
      <button type="button" disabled={busy} onClick={() => void toggle()}>
        {busy
          ? "Updating…"
          : enabled
            ? "Turn off on this device"
            : "Enable notifications"}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
