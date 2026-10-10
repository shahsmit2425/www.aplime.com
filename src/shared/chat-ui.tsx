import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import "./chat.css";
export type ChatItem = {
  id: string;
  name: string;
  subtitle: string;
  preview: string;
  time?: string;
  unread: number;
  support?: boolean;
};
export type ChatMessage = {
  id: string;
  body: string;
  name: string;
  time: string;
  mine: boolean;
};
export const chatTime = (value?: string) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
export function ChatInbox({
  items,
  selected,
  onSelect,
  children,
  tools,
  footer,
  loading,
  error,
}: {
  items: ChatItem[];
  selected?: string;
  onSelect: (id: string) => void;
  children?: ReactNode;
  tools?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const visible = items.filter((i) =>
    [i.name, i.subtitle, i.preview]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <div className={"chat-inbox" + (selected ? " chat-has-selection" : "")}>
      <aside className="chat-sidebar" aria-label="Conversations">
        <div className="chat-sidebar-heading">
          <div>
            <small>STAY CONNECTED</small>
            <h2>Messages</h2>
          </div>
          {tools}
        </div>
        <label className="chat-search">
          <Search size={18} />
          <input
            aria-label="Search loaded conversations"
            placeholder="Search conversations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {loading && (
          <p className="chat-status" role="status">
            Loading conversations…
          </p>
        )}
        {error && (
          <p className="chat-error" role="alert">
            {error}
          </p>
        )}
        <nav className="chat-conversations" aria-label="Choose a conversation">
          {visible.map((i) => (
            <button
              type="button"
              key={i.id}
              onClick={() => onSelect(i.id)}
              aria-current={selected === i.id ? "true" : undefined}
              className={"chat-choice" + (selected === i.id ? " selected" : "")}
            >
              <span
                className={"chat-avatar" + (i.support ? " is-support" : "")}
                aria-hidden="true"
              >
                {i.support ? (
                  <ShieldCheck size={23} />
                ) : (
                  i.name.slice(0, 2).toUpperCase()
                )}
              </span>
              <span className="chat-choice-copy">
                <span className="chat-choice-top">
                  <strong>{i.name}</strong>
                  <time title={i.time ? new Date(i.time).toLocaleString() : ""}>
                    {chatTime(i.time)}
                  </time>
                </span>
                <small>{i.subtitle}</small>
                <span className="chat-choice-preview">
                  <span>{i.preview || "Start the conversation"}</span>
                  {i.unread > 0 && (
                    <b aria-label={i.unread + " unread updates"}>
                      {i.unread > 99 ? "99+" : i.unread}
                    </b>
                  )}
                </span>
              </span>
            </button>
          ))}
          {!loading && !visible.length && (
            <p className="chat-status">
              {query
                ? "No conversations match this search."
                : "Your conversations will appear here."}
            </p>
          )}
        </nav>
        {footer && <div className="chat-sidebar-footer">{footer}</div>}
      </aside>
      <section className="chat-main">
        {children || (
          <div className="chat-empty">
            <span>
              <MessageCircle size={38} />
            </span>
            <h2>A good conversation starts here</h2>
            <p>
              Choose a project chat or contact Aplime support. Your messages
              stay connected to your account.
            </p>
            <small>
              Chatting does not book a job. Never share passwords or identity
              documents.
            </small>
          </div>
        )}
      </section>
    </div>
  );
}
export function ChatHeader({
  title,
  subtitle,
  back,
  actions,
  support = false,
}: {
  title: string;
  subtitle: string;
  back?: () => void;
  actions?: ReactNode;
  support?: boolean;
}) {
  return (
    <header className="chat-header">
      {back && (
        <button
          type="button"
          className="chat-back"
          aria-label="Back to conversations"
          onClick={back}
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <span className={"chat-avatar" + (support ? " is-support" : "")}>
        {support ? <ShieldCheck /> : title.slice(0, 2).toUpperCase()}
      </span>
      <div className="chat-header-copy">
        <h3>{title}</h3>
        <small>{subtitle}</small>
      </div>
      <div className="chat-header-actions">{actions}</div>
    </header>
  );
}
export function ChatLog({
  messages,
  threadKey,
  before,
  ownLabel = "You",
}: {
  messages: ChatMessage[];
  threadKey: string;
  before?: ReactNode;
  ownLabel?: string;
}) {
  const log = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true),
    previous = useRef("");
  const [more, setMore] = useState(false);
  const fingerprint = messages.map((m) => m.id).join(",");
  const bottom = () => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
    nearBottom.current = true;
    setMore(false);
  };
  useEffect(() => {
    if (previous.current !== threadKey || nearBottom.current) bottom();
    else setMore(true);
    previous.current = threadKey;
  }, [threadKey, fingerprint]);
  return (
    <div className="chat-log-wrap">
      <div
        className="chat-log"
        ref={log}
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        aria-relevant="additions"
        onScroll={() => {
          const el = log.current!;
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 90;
          if (nearBottom.current) setMore(false);
        }}
      >
        {before}
        <p className="chat-privacy">
          Private account conversation · Aplime may review messages for support
          and safety.
        </p>
        {!messages.length && (
          <p className="chat-status">No messages yet. Say hello.</p>
        )}
        {messages.map((m, i) => (
          <div key={m.id}>
            {(i === 0 ||
              new Date(messages[i - 1].time).toDateString() !==
                new Date(m.time).toDateString()) && (
              <div className="chat-day">
                {new Date(m.time).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            )}
            <article className={"chat-bubble" + (m.mine ? " mine" : "")}>
              <strong>{m.mine ? ownLabel : m.name}</strong>
              <p>{m.body}</p>
              <time dateTime={m.time} title={new Date(m.time).toLocaleString()}>
                {chatTime(m.time)}
              </time>
            </article>
          </div>
        ))}
      </div>
      {more && (
        <button className="chat-new-messages" onClick={bottom}>
          <ArrowDown size={16} /> New messages
        </button>
      )}
    </div>
  );
}
export function ChatComposer({
  value,
  onChange,
  send,
  disabled,
  placeholder = "Write a message…",
}: {
  value: string;
  onChange: (v: string) => void;
  send: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <form
      className="chat-composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) send();
      }}
    >
      <div>
        <label className="sr-only" htmlFor="chat-message-input">
          Message
        </label>
        <textarea
          id="chat-message-input"
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={4000}
          disabled={disabled}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              window.matchMedia("(pointer: fine)").matches
            ) {
              e.preventDefault();
              if (!disabled && value.trim()) send();
            }
          }}
        />
        <small>Shift + Enter for a new line · {value.length}/4,000</small>
      </div>
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        <Send size={19} />
        <span>Send</span>
      </button>
    </form>
  );
}
// Acknowledge only the notification IDs from the displayed snapshot, never future messages.
export function useChatRead(
  ids: string[],
  acknowledge: (ids: string[]) => Promise<unknown>,
) {
  const action = useRef(acknowledge);
  action.current = acknowledge;
  const key = ids.join(",");
  useEffect(() => {
    let pending = false,
      done = false,
      stopped = false;
    const read = async () => {
      if (!key || pending || done || document.visibilityState !== "visible")
        return;
      pending = true;
      try {
        await action.current(key.split(",").slice(0, 1000));
        done = true;
        if (!stopped) window.dispatchEvent(new Event("aplime:chat-read"));
      } catch {
        /* Retry on focus or next polling snapshot. */
      } finally {
        pending = false;
      }
    };
    void read();
    const timer = setInterval(() => void read(), 10000);
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", read);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", read);
      document.removeEventListener("visibilitychange", read);
    };
  }, [key]);
}
