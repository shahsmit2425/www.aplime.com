import { useEffect, type ReactNode } from "react";
// Keep the shared text helpers so existing UI and user-written content stay intact.
// English is the sole interface language, including accounts with legacy preferences.
export function LanguageProvider({children}: {children: ReactNode}) {
  useEffect(() => {
    document.documentElement.lang = "en";
    try { localStorage.removeItem("aplime-language"); } catch {}
  }, []);
  return <>{children}</>;
}
export const translate = (text: string) => text;
export const useT = () => translate;
export function T({children}: {children: string}) { return <>{children}</>; }
