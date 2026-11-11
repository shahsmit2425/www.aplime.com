import type { Role } from "../shared/domain.js";

export const authPages = new Set(["login", "register", "recovery"]);

export function accountLandingPage(
  role: Exclude<Role, "admin">,
  hasProfessionalProfile: boolean,
) {
  return role === "pro" && !hasProfessionalProfile
    ? "onboarding"
    : "dashboard";
}

export function pageAfterAuthentication(
  currentPage: string,
  role: Exclude<Role, "admin">,
  hasProfessionalProfile: boolean,
) {
  return authPages.has(currentPage)
    ? accountLandingPage(role, hasProfessionalProfile)
    : currentPage;
}
