import type { Profile } from "./domain.js";

// The four things a professional finishes before customers can find them,
// in the order they are done. Marketplace review is last because Aplime
// reviews the saved profile after identity verification.
export function setupSteps(
  profile: Profile | undefined,
  membershipActive: boolean,
) {
  const live =
    !!profile && (profile.listed || profile.reviewStatus === "approved");
  return [
    {
      key: "profile",
      page: "profile",
      label: "Business profile",
      detail: profile ? "Details saved" : "Introduce your business",
      complete: !!profile,
    },
    {
      key: "identity",
      page: "verification",
      label: "Identity verification",
      detail: profile?.verified ? "Identity confirmed" : "Photo ID and selfie",
      complete: !!profile?.verified,
    },
    {
      key: "membership",
      page: "subscription",
      label: "Membership",
      detail: membershipActive ? "Membership active" : "Choose your plan",
      complete: membershipActive,
    },
    {
      key: "review",
      page: "profile",
      id: "setup",
      label: "Marketplace review",
      detail: profile?.suspended
        ? "Contact support"
        : live
          ? "Listing approved"
          : profile?.reviewStatus === "pending"
            ? "Review in progress"
            : profile?.reviewStatus === "changes_requested"
              ? "Changes requested"
              : "Submit your finished profile",
      complete: live && !profile!.suspended,
    },
  ];
}
