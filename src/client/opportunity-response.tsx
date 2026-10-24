import { responseLabels, type Project } from "../shared/domain.js";
import { useWorkspace } from "./workspace.js";
import { request } from "./api.js";
export function OpportunityResponse({ project }: { project: Project }) {
  const { data, run, busy } = useWorkspace();
  const response = data.projectResponses?.find(
    (r) => r.projectId === project.id && r.proId === data.user.id,
  );
  return (
    <section
      className="opportunity-response"
      aria-label="Your project response"
    >
      <strong>
        {response
          ? `Your response: ${responseLabels[response.status]}`
          : "Can you help with this project?"}
      </strong>
      <p>
        The customer can see your response. This does not book the job. Use
        Message customer to ask a specific question.
      </p>
      <div className="actions">
        {(
          Object.keys(responseLabels) as Array<keyof typeof responseLabels>
        ).map((status) => (
          <button
            key={status}
            className="secondary"
            aria-pressed={response?.status === status}
            disabled={busy || response?.status === status}
            onClick={() =>
              void run(
                () =>
                  request(`/projects/${project.id}/actions`, {
                    type: "respond_opportunity",
                    status,
                    expectedVersion: project.version,
                  }),
                "Response saved. The customer has been notified.",
              )
            }
          >
            {responseLabels[status]}
          </button>
        ))}
      </div>
    </section>
  );
}
