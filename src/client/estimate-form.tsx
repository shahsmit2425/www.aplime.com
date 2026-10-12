import { useState } from "react";
import type { Quote } from "../shared/domain.js";
import { useWorkspace } from "./workspace.js";
import { Form, Field } from "./ui.js";
export function EstimateForm({
  quote,
  submit,
}: {
  quote?: Quote;
  submit: (body: unknown) => Promise<unknown>;
}) {
  const { busy, run } = useWorkspace();
  const [assessment, setAssessment] = useState(!!quote?.assessmentRequired);
  return (
    <Form
      busy={busy}
      onSubmit={(f) =>
        run(
          () =>
            submit({
              type: "quote",
              assessmentRequired: assessment,
              laborAmount: assessment
                ? 0
                : Math.round(Number(f.get("price")) * 100),
              materialsAmount: 0,
              estimatedDays: assessment ? null : Number(f.get("days")),
              description: String(f.get("comments") || ""),
              exclusions: quote?.exclusions || "",
              timeline: "",
              expiresAt: null,
            }),
          assessment
            ? "Assessment request sent. Add pricing here when you are ready."
            : quote
              ? "Estimate updated."
              : "Estimate sent.",
        )
      }
    >
      <h3>{quote ? "Update your estimate" : "Send an estimate"}</h3>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={assessment}
          onChange={(e) => setAssessment(e.target.checked)}
        />{" "}
        Assessment needed before pricing
      </label>
      {assessment ? (
        <p className="project-state-note">
          Discuss the job by chat or schedule a call first. Return here to add
          your price and estimated days when ready.
        </p>
      ) : (
        <div className="form-grid">
          <Field label="Total price (USD)">
            <input
              name="price"
              type="number"
              min="1"
              max="100000"
              step=".01"
              required
              defaultValue={
                quote?.amount != null ? quote.amount / 100 : undefined
              }
            />
          </Field>
          <Field label="Estimated days to finish">
            <input
              name="days"
              type="number"
              min="1"
              max="3650"
              step="1"
              required
              defaultValue={quote?.estimatedDays || undefined}
            />
          </Field>
        </div>
      )}
      <Field label="Comments (optional)">
        <textarea
          name="comments"
          maxLength={2000}
          defaultValue={quote?.description || ""}
          placeholder="Anything the customer should know"
        />
      </Field>
      <button>
        {assessment
          ? "Send assessment request"
          : quote
            ? "Update estimate"
            : "Send estimate"}
      </button>
    </Form>
  );
}
