import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { spanish } from "./spanish.js";
export type Language = "en" | "es";
export const languageOf = (value: unknown): Language =>
  value === "es" ? "es" : "en";
export function translate(text: string, language: Language) {
  return language === "es" && Object.hasOwn(spanish, text) ? spanish[text] : text;
}
const Context = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({ language: "en", setLanguage: () => {} });
export function LanguageProvider({
  children,
  initialLanguage = "en",
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setLanguage(languageOf(localStorage.getItem("aplime-language")));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = language;
    try {
      localStorage.setItem("aplime-language", language);
    } catch {}
  }, [language, ready]);
  return (
    <Context.Provider value={{ language, setLanguage }}>
      {children}
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
export function useT() {
  const { language } = useLanguage();
  return (text: string) => translate(text, language);
}
export function T({ children }: { children: string }) {
  const t = useT();
  return <>{t(children)}</>;
}
export function LanguageSelect({
  onChange,
}: { onChange?: (language: Language) => Promise<void> } = {}) {
  const { language, setLanguage } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="language-picker">
      <label>
        <span className="sr-only">Language / Idioma</span>
        <select
          aria-label="Language / Idioma"
          value={language}
          disabled={busy}
          onChange={async (e) => {
            const next = languageOf(e.target.value);
            setError("");
            if (onChange) {
              setBusy(true);
              try {
                await onChange(next);
                setLanguage(next);
              } catch {
                setError(
                  language === "es"
                    ? "No se pudo guardar el idioma. Inténtalo de nuevo."
                    : "Could not save your language. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            } else setLanguage(next);
          }}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </label>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
