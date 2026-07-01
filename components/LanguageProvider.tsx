"use client";

import { createContext, useContext } from "react";
import { Lang, T, translations } from "@/lib/i18n";

type LanguageContextValue = {
  lang: Lang;
  t: T;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  t: translations.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  return (
    <LanguageContext.Provider value={{ lang: "en", t: translations.en }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
