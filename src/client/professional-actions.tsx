import { useWorkspace } from "./workspace.js";
import { ChatWithPro } from "./project-actions.js";
import { ScheduleCallButton } from "./call-meetings.js";

// Every marketplace card exposes the same actions; project permissions still
// determine whether chat and scheduling are available.
export function ProfessionalActions({
  proId,
  projectId,
  canContact = true,
}: {
  proId: string;
  projectId?: string;
  canContact?: boolean;
}) {
  const { data, go } = useWorkspace();
  const project = [...data.projects, ...data.leads].find(
    (p) => p.id === projectId,
  );
  const canSchedule =
    project &&
    !["completed", "cancelled", "disputed"].includes(project.status) &&
    (!project.proId || project.proId === proId);
  return (
    <>
      {projectId && canContact && (
        <ChatWithPro projectId={projectId} proId={proId} label="Chat" />
      )}
      {projectId && canContact && canSchedule && (
        <ScheduleCallButton projectId={projectId} proId={proId} />
      )}
      <button type="button" onClick={() => go("pro", proId)}>
        View profile
      </button>
    </>
  );
}
