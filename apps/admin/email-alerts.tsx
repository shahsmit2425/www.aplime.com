import { useEffect, useState } from "react";
import { emailCategories } from "../../src/shared/email-alerts.js";
type Requester = <T>(path: string, body?: unknown) => Promise<T>;
export function EmailAlerts({
  request,
  run,
  busy,
  go,
}: {
  request: Requester;
  run: (fn: () => Promise<void>) => Promise<void>;
  busy: boolean;
  go: (page: string, id?: string) => void;
}) {
  const [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    request<any>(`/email-alerts?page=${page}&status=${status}`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [request, page, status, revision]);
  async function mutate(path: string, body: unknown) {
    await run(async () => {
      await request(path, body);
      setRevision((n) => n + 1);
    });
  }
  return (
    <section style={{ display: "grid", gap: 24 }}>
      <div className="admin-actions">
        <button onClick={() => go("users")}>Send a message to a user</button>
        <button className="secondary" onClick={() => setRevision((n) => n + 1)}>
          Refresh deliveries
        </button>
      </div>
      <p>
        Automatic alerts are sent through Resend. Direct administrator
        messages appear in the user's support inbox and send an email. Security,
        billing and direct Aplime support notices remain enabled.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {data ? (
        <>
          <section className="admin-card">
            <h2>Optional event emails</h2>
            <div className="admin-actions">
              {data.categories.map((c: any) => (
                <button
                  className="secondary"
                  disabled={busy}
                  aria-pressed={c.enabled}
                  key={c.category}
                  onClick={() =>
                    void mutate("/email-alerts/settings", {
                      category: c.category,
                      enabled: !c.enabled,
                    })
                  }
                >
                  {emailCategories[c.category as keyof typeof emailCategories]}:{" "}
                  {c.enabled ? "On" : "Off"}
                </button>
              ))}
            </div>
            <p>
              Disabled categories skip pending optional emails too. In-app
              alerts continue. Turning a category back on affects future alerts.
            </p>
          </section>
          <section className="admin-card">
            <h2>Email deliveries</h2>
            <label>
              Delivery status{" "}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {["all", "pending", "failed", "sent", "skipped"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row: any) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.email}</td>
                      <td>{row.subject}</td>
                      <td>
                        {row.sentAt
                          ? "Accepted by email provider"
                          : row.cancelledAt
                            ? "Skipped"
                            : row.attempts >= 8
                              ? "Failed"
                              : "Pending"}
                      </td>
                      <td>{row.attempts}</td>
                      <td>
                        {!row.sentAt &&
                          !row.cancelledAt &&
                          row.attempts >= 8 && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void mutate(`/email-alerts/${row.id}/retry`, {})
                              }
                            >
                              Retry
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.rows.length && <p>No emails in this view.</p>}
            <div className="admin-actions">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} · {data.total} deliveries
              </span>
              <button
                disabled={page * 25 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </section>
          <details className="admin-card">
            <summary>Branded email template preview</summary>
            <iframe
              title="Aplime email preview"
              sandbox=""
              srcDoc={data.preview.html}
              style={{
                width: "100%",
                height: 520,
                border: "1px solid #d5e3da",
              }}
            />
            <p>
              Project, meeting, business, review, billing and support events use
              this layout with their own subject, message and account link.
            </p>
          </details>
        </>
      ) : (
        !error && <p>Loading email alerts…</p>
      )}
    </section>
  );
}
