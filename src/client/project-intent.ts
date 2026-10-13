import { categories } from "../shared/domain.js";
import type { ServiceCategory } from "../shared/service-questionnaires.js";
type Intent = { category?: ServiceCategory; town?: string; expiresAt: number };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = "aplime-project-intent";
// Only service/locality hints cross sign-in. No customer address or place ID is stored here.
export function projectIntent(
  search: string,
  store: Store,
  now = Date.now(),
): Intent | null {
  const params = new URLSearchParams(search),
    category = params.get("category"),
    town = params.get("town")?.trim();
  const validCategory = categories.find((c) => c === category);
  try {
    if (validCategory) {
      const intent: Intent = {
        category: validCategory,
        ...(town && town.length <= 100 && /^[\p{L} .'-]+$/u.test(town)
          ? { town }
          : {}),
        expiresAt: now + 3600000,
      };
      store.setItem(key, JSON.stringify(intent));
      return intent;
    }
    const saved = JSON.parse(store.getItem(key) || "null");
    if (
      saved &&
      saved.expiresAt > now &&
      saved.expiresAt <= now + 3600000 &&
      categories.includes(saved.category) &&
      (!saved.town ||
        (typeof saved.town === "string" &&
          saved.town.length <= 100 &&
          /^[\p{L} .'-]+$/u.test(saved.town)))
    )
      return {
        category: saved.category,
        town: saved.town,
        expiresAt: saved.expiresAt,
      };
    store.removeItem(key);
  } catch {
    /* Private browsing may disable storage; URL hints still work on this page. */
  }
  return validCategory
    ? {
        category: validCategory,
        town: town && /^[\p{L} .'-]{1,100}$/u.test(town) ? town : undefined,
        expiresAt: now + 3600000,
      }
    : null;
}
export function clearProjectIntent(store: Store) {
  try {
    store.removeItem(key);
  } catch {}
}
