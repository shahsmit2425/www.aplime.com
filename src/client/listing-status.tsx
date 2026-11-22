import { CircleAlert, CircleCheck, CircleSlash, Clock3 } from "lucide-react";
import type { Profile } from "../shared/domain.js";

// Where a business stands with marketplace review, and what its owner
// should do next. Shown above every business profile section.
function listingStatus(p: Profile) {
  const live = p.listed || p.reviewStatus === "approved";
  if (p.suspended)
    return {
      tone: "stop",
      Icon: CircleSlash,
      title: "Listing suspended",
      note: p.suspensionNote,
      body: "Customers cannot find or contact your business. Contact support with questions.",
    };
  if (p.reviewStatus === "pending")
    return {
      tone: "wait",
      Icon: Clock3,
      title: live ? "Live · changes in review" : "In review",
      body: live
        ? "Customers see your approved listing until your latest edits are reviewed."
        : "We will notify you of the decision. If you edit now, the latest version is reviewed.",
    };
  if (p.reviewStatus === "changes_requested")
    return {
      tone: "act",
      Icon: CircleAlert,
      title: live ? "Live · changes requested" : "Changes requested",
      note: p.reviewNote,
      body: live
        ? "Customers still see your approved listing. Update your profile to send it back for review."
        : "Update your profile, then resubmit it for review.",
      next: true,
    };
  if (live)
    return {
      tone: "live",
      Icon: CircleCheck,
      title: "Approved",
      body: "Listed in search while your identity is verified and your membership is active.",
    };
  if (p.reviewStatus === "rejected")
    return {
      tone: "stop",
      Icon: CircleSlash,
      title: "Not approved",
      note: p.reviewNote,
      body: "Customers cannot see your listing. Update your profile and resubmit it for review.",
      next: true,
    };
  return {
    tone: "act",
    Icon: CircleAlert,
    title: "Draft · not submitted",
    body: "Customers cannot see your listing yet. Submit it for review when it is ready.",
    next: true,
  };
}
export function ListingStatus({
  profile,
  onReview,
}: {
  profile: Profile;
  onReview?: () => void;
}) {
  const { tone, Icon, title, note, body, next } = listingStatus(profile);
  return (
    <div className="listing-status" data-tone={tone} role="status">
      <Icon size={22} />
      <div>
        <strong>{title}</strong>
        {note && <p className="listing-status-note">{note}</p>}
        <p>{body}</p>
      </div>
      {next && onReview && (
        <button type="button" className="secondary" onClick={onReview}>
          Marketplace review
        </button>
      )}
    </div>
  );
}
