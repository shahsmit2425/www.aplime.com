import { Clock3, ShieldCheck } from "lucide-react";
import type { Profile } from "../shared/domain.js";

export function PortfolioPublication({
  profile,
  onReview,
}: {
  profile: Profile;
  onReview: () => void;
}) {
  const publication = profile.portfolioPublication;
  if (!publication) return null;
  const pending = publication.hasUnpublishedChanges;
  return (
    <div className="portfolio-publication" data-pending={pending}>
      {pending ? <Clock3 size={22} /> : <ShieldCheck size={22} />}
      <div>
        <strong>
          {publication.approvedImageIds.length} past-work photos approved for
          your customer profile
        </strong>
        {pending && (
          <p>
            {profile.reviewStatus === "pending"
              ? "Customers see your last approved portfolio until your photo changes are approved."
              : "Complete marketplace review to show your photo changes to customers."}
          </p>
        )}
      </div>
      {pending && (
        <button type="button" className="secondary" onClick={onReview}>
          Review status
        </button>
      )}
    </div>
  );
}
