import { useState } from "react";
import { money } from "../shared/domain.js";
import { Panel } from "./ui.js";

export function AwardResponse({
  busy,
  customer,
  proName,
  amount,
  accept,
  decline,
  withdraw,
}: {
  busy: boolean;
  customer: boolean;
  proName?: string;
  amount: number | null;
  accept: () => void;
  decline: (reason: string) => void;
  withdraw: () => void;
}) {
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  if (customer)
    return (
      <Panel title="Waiting for the professional to confirm">
        <p>
          You selected {proName || "a professional"}
          {amount ? " at " + money(amount) : ""}. Work cannot start until they
          confirm. Your other estimates stay on hold meanwhile.
        </p>
        <button
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Withdraw this selection and reopen your request for estimates?",
              )
            )
              withdraw();
          }}
        >
          Withdraw selection
        </button>
      </Panel>
    );
  return (
    <Panel title="You were selected for this job">
      <p>
        The customer chose your estimate{amount ? " of " + money(amount) : ""}.
        Confirm that you can take the job, or decline so they can choose someone
        else.
      </p>
      {declining ? (
        <>
          <label>
            Reason for declining (the customer can see this)
            <textarea
              value={reason}
              minLength={5}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="actions">
            <button
              disabled={busy || reason.trim().length < 5}
              onClick={() => decline(reason.trim())}
            >
              Decline job
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setDeclining(false)}
            >
              Back
            </button>
          </div>
        </>
      ) : (
        <div className="actions">
          <button disabled={busy} onClick={accept}>
            Confirm job
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setDeclining(true)}
          >
            Decline job
          </button>
        </div>
      )}
    </Panel>
  );
}
