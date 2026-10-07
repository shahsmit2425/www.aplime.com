import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  ArrowLeft,
  ShieldCheck,
  FileCheck2,
  Camera,
  LockKeyhole,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ExternalLink,
  CircleAlert,
} from "lucide-react";
import { useWorkspace } from "./workspace.js";
import { request, openExternal, ApiError } from "./api.js";
import { verifyWithStripe } from "./stripe-identity.js";
import { Empty, Head } from "./ui.js";
import { fallbackConfig } from "../shared/config.js";
import { ProfessionalSetup } from "./professional-setup.js";

type Verification = {
  status:
    "not_started" | "requires_input" | "processing" | "verified" | "canceled";
  awaitingConfirmation?: boolean;
  needsAttention?: boolean;
  message?: string;
  url?: string;
  clientSecret?: string;
  publishableKey?: string;
};
export function IdentityVerification() {
  const { data, id, go, run, busy } = useWorkspace();
  const profile = data.profiles.find((p) => p.id === data.user.id);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [checkError, setCheckError] = useState("");
  const [feedback, setFeedback] = useState("");
  const mounted = useRef(true);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setChecking(true);
    try {
      const result = await request<Verification>("/profile/identity");
      if (mounted.current) {
        setVerification(result);
        setCheckError("");
      }
    } catch (error) {
      if (mounted.current)
        setCheckError(
          error instanceof ApiError
            ? error.message
            : "We could not check verification right now. Refresh the status or contact support if this continues.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setChecking(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (data.user.role !== "pro" || !profile) return;
    void refresh();
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(focus, 15000);
    window.addEventListener("focus", focus);
    window.addEventListener("aplime:updates", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("aplime:updates", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [refresh, profile?.id, profile?.verified, data.user.role]);
  if (data.user.role !== "pro")
    return (
      <Empty title="Professional account required">
        Identity verification is available for professional account holders.
      </Empty>
    );
  if (!profile)
    return (
      <Empty title="Save your business details first">
        <button onClick={() => go("profile")}>Set up business profile</button>
      </Empty>
    );
  const status = profile.verified ? "verified" : verification?.status;
  const processing = status === "processing";
  const confirmed = status === "verified";
  const support = (window.__CONFIG__ || fallbackConfig).supportEmail;
  const start = (hosted = false) => {
    void run(async () => {
      setError("");
      setFeedback("");
      try {
        const session = await request<Verification>("/profile/identity", {});
        // Keep only safe status fields in React state; never keep the session secret or URL.
        const { clientSecret, publishableKey, url, ...state } = session;
        setVerification(state);
        if (["verified", "processing"].includes(session.status)) {
          await refresh();
          return;
        }
        if (!url)
          throw new Error(
            "Verification could not start. Please try again shortly.",
          );
        if (
          hosted ||
          Capacitor.isNativePlatform() ||
          !clientSecret ||
          !publishableKey
        ) {
          await openExternal(url);
          return;
        }
        const result = await verifyWithStripe(publishableKey, clientSecret);
        if (result.error) {
          if (result.error.code === "session_cancelled")
            setFeedback(
              "You closed verification. Your progress can be resumed below.",
            );
          else
            setError(
              result.error.message ||
                "Verification could not finish. Try again or use the secure Stripe page.",
            );
          await refresh();
          return;
        }
        go("verification", "return");
        setFeedback(
          "Your verification session has finished. We’re checking its status; approval appears after Stripe confirms the result.",
        );
        await refresh();
      } catch (e) {
        setError(
          (e as Error).message ||
            "Verification could not start. Please try again.",
        );
      }
    }, "");
  };
  return (
    <>
      <button
        type="button"
        className="text-button"
        onClick={() => go("profile")}
      >
        <ArrowLeft size={16} /> Back to business profile
      </button>
      <Head title="Verify your identity">
        A secure ID check helps customers know who they are working with.
      </Head>
      <ProfessionalSetup
        profile={profile}
        current="verification"
        identityVerified={confirmed}
        go={go}
      />
      <div className="identity-layout">
        <section className="identity-main">
          <div className="identity-status-icon">
            {confirmed ? (
              <CheckCircle2 size={34} />
            ) : processing ? (
              <Clock3 size={34} />
            ) : (
              <ShieldCheck size={34} />
            )}
          </div>
          <p className="eyebrow">POWERED BY STRIPE IDENTITY</p>
          <h2>
            {confirmed
              ? "Your identity is verified"
              : processing
                ? "Your verification is being checked"
                : verification?.needsAttention
                  ? "Let’s complete your verification"
                  : status === "canceled"
                    ? "You can start again"
                    : "A simple check. A more trusted profile."}
          </h2>
          <p>
            {confirmed
              ? "Stripe has confirmed the account holder’s identity. You can continue your business profile review and membership setup."
              : processing
                ? verification?.awaitingConfirmation
                  ? "Stripe has finished the check. We’re waiting for its secure confirmation before updating your profile."
                  : "Your documents are being reviewed. You can leave this page; we’ll notify you when the result arrives."
                : status === "canceled"
                  ? "The previous verification was canceled. Start a new secure session when you’re ready."
                  : "Have your government-issued ID ready. Stripe will guide you through a document photo and a matching selfie."}
          </p>
          {id === "return" && !confirmed && (
            <p className="business-tip">
              Welcome back. Returning from Stripe does not confirm approval.
              Your current result is shown here.
            </p>
          )}
          {verification?.message && !confirmed && (
            <p className="business-tip">
              <CircleAlert size={18} /> {verification.message}
            </p>
          )}
          {feedback && (
            <p className="business-tip" role="status">
              {feedback}
            </p>
          )}
          {checkError && (
            <p className="business-upload-error" role="alert">
              {checkError}
            </p>
          )}
          {error && (
            <p className="business-upload-error" role="alert">
              {error}
            </p>
          )}
          <div className="identity-actions">
            {confirmed ? (
              <button onClick={() => go("subscription")}>
                <CheckCircle2 size={18} /> Continue to membership
              </button>
            ) : (
              !processing && (
                <button
                  disabled={busy || checking || !verification}
                  onClick={() => start()}
                >
                  <ShieldCheck size={18} />{" "}
                  {busy
                    ? "Opening verification…"
                    : checking && !verification
                      ? "Checking status…"
                      : status === "requires_input"
                        ? verification?.needsAttention
                          ? "Try verification again"
                          : "Continue verification"
                        : "Start identity verification"}
                </button>
              )
            )}
            <button
              className="secondary"
              disabled={busy || checking}
              onClick={() => void refresh()}
            >
              <RefreshCw size={16} />{" "}
              {checking ? "Checking…" : "Refresh status"}
            </button>
          </div>
          {!confirmed && !processing && verification && (
            <button
              className="text-button"
              disabled={busy || checking}
              onClick={() => start(true)}
            >
              <ExternalLink size={16} /> Open secure Stripe page instead
            </button>
          )}
          <div className="identity-progress" aria-label="Verification progress">
            {[
              "Prepare your ID",
              "Submit to Stripe",
              "Receive confirmation",
            ].map((label, index) => (
              <div
                key={label}
                className={
                  confirmed || (processing && index < 2) ? "complete" : ""
                }
              >
                <span>
                  {confirmed || (processing && index < 2) ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    index + 1
                  )}
                </span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
        </section>
        <aside className="identity-guide">
          <h2>Before you begin</h2>
          <div>
            <FileCheck2 size={24} />
            <span>
              <strong>A valid photo ID</strong>
              <p>
                Use an unexpired passport, driver’s license or another document
                accepted in the Stripe flow.
              </p>
            </span>
          </div>
          <div>
            <Camera size={24} />
            <span>
              <strong>A clear photo and selfie</strong>
              <p>
                Use good lighting. Keep the full document visible and make sure
                your camera is available.
              </p>
            </span>
          </div>
          <div>
            <LockKeyhole size={24} />
            <span>
              <strong>Handled securely by Stripe</strong>
              <p>
                Your ID and selfie go directly to Stripe. Aplime does not store
                them in business image storage.
              </p>
            </span>
          </div>
          <p className="identity-scope">
            This checks the account holder’s identity. Business review,
            licenses, insurance and your Aplime subscription are separate.
          </p>
          <div className="identity-help-links">
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Stripe privacy <ExternalLink size={14} />
            </a>
            <button className="text-button" onClick={() => go("help")}>
              Get help
            </button>
            {support && <a href={"mailto:" + support}>Contact support</a>}
          </div>
        </aside>
      </div>
    </>
  );
}
