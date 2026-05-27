import i18next from "i18next";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import de from "@/locales/de.json";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import it from "@/locales/it.json";
import ja from "@/locales/ja.json";
import ko from "@/locales/ko.json";
import ptBR from "@/locales/pt-BR.json";
import zh from "@/locales/zh.json";
import { STORAGE_KEYS } from "./storage";

export type Language = "en" | "ja" | "zh" | "ko" | "es" | "pt-BR" | "it" | "fr" | "de";
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const LANGUAGE_CHOICES: Array<{ value: Language; label: string; nativeLabel: string }> = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "ja", label: "Japanese", nativeLabel: "日本語" },
  { value: "zh", label: "Chinese", nativeLabel: "简体中文" },
  { value: "ko", label: "Korean", nativeLabel: "한국어" },
  { value: "es", label: "Spanish", nativeLabel: "Español" },
  { value: "pt-BR", label: "Portuguese", nativeLabel: "Português (Brasil)" },
  { value: "it", label: "Italian", nativeLabel: "Italiano" },
  { value: "fr", label: "French", nativeLabel: "Français" },
  { value: "de", label: "German", nativeLabel: "Deutsch" },
];

const LANGUAGE_VALUES = new Set<Language>(LANGUAGE_CHOICES.map(({ value }) => value));

const i18n = i18next.createInstance();
void i18n.init({
  fallbackLng: "en",
  lng: "en",
  resources: {
    de: { translation: de },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    it: { translation: it },
    ja: { translation: ja },
    ko: { translation: ko },
    "pt-BR": { translation: ptBR },
    zh: { translation: zh },
  },
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
  keySeparator: false,
  nsSeparator: false,
  returnNull: false,
});

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLanguage(value: unknown): Language {
  return typeof value === "string" && LANGUAGE_VALUES.has(value as Language)
    ? (value as Language)
    : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [languageRaw, setLanguageRaw] = usePersistedState<Language>(
    STORAGE_KEYS.language,
    "en",
  );
  const language = normalizeLanguage(languageRaw);

  const setLanguage = useCallback((next: Language) => {
    setLanguageRaw(next);
  }, [setLanguageRaw]);

  const t = useCallback<Translate>(
    (key, vars) => i18n.t(key, { ...vars, lng: language }) as string,
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
