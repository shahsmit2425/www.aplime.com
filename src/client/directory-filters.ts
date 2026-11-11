import type { Profile } from "../shared/domain.js";
export type DirectoryFilters = {
  query: string;
  category: string;
  verified: boolean;
  sort: string;
};
// Refine only the profiles already authorized and matched by the workspace.
export function filterDirectory(
  profiles: Profile[],
  filters: DirectoryFilters,
) {
  const query = filters.query.trim().toLocaleLowerCase();
  const result = profiles.filter(
    (p) =>
      (!query ||
        [p.business, p.bio, p.zip, ...p.serviceCategories]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)) &&
      (!filters.category || p.serviceCategories.includes(filters.category)) &&
      (!filters.verified || p.verified),
  );
  if (filters.sort === "rate")
    result.sort(
      (a, b) => a.rate - b.rate || a.business.localeCompare(b.business),
    );
  if (filters.sort === "rating")
    result.sort(
      (a, b) =>
        Number(b.reviewCount > 0) - Number(a.reviewCount > 0) ||
        b.rating - a.rating ||
        b.reviewCount - a.reviewCount,
    );
  if (filters.sort === "name")
    result.sort((a, b) => a.business.localeCompare(b.business));
  return result;
}
