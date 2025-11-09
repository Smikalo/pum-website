// web/context/I18nProvider.tsx
"use client";

import React from "react";
import en from "@/i18n/en.json";
import de from "@/i18n/de.json";

export type Lang = "en" | "de";

type Messages = Record<string, string>;

const dictionaries: Record<Lang, Messages> = {
    en: en as Messages,
    de: de as Messages,
};

type I18nContextValue = {
    lang: Lang;
    setLang: (lang: Lang) => void;
    t: (key: string) => string;
};

const I18nContext = React.createContext<I18nContextValue | undefined>(
    undefined,
);

const STORAGE_KEY = "lang";

function detectInitialLang(): Lang {
    if (typeof window === "undefined") {
        return "en";
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "de") return stored;

    const navLang =
        (window.navigator.languages && window.navigator.languages[0]) ||
        window.navigator.language;

    if (navLang && navLang.toLowerCase().startsWith("de")) {
        return "de";
    }

    return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLang] = React.useState<Lang>(detectInitialLang);

    // Keep DOM + localStorage + legacy event in sync with current language
    React.useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, lang);

            // Keep compatibility with the existing custom event
            window.dispatchEvent(
                new CustomEvent("pum:lang", { detail: { lang } }),
            );
        }

        if (typeof document !== "undefined") {
            document.documentElement.lang = lang;
        }
    }, [lang]);

    const t = React.useCallback(
        (key: string): string => {
            const dict = dictionaries[lang] || dictionaries.en;
            if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
                return dict[key] as string;
            }
            const fallback = dictionaries.en?.[key];
            return typeof fallback === "string" ? fallback : key;
        },
        [lang],
    );

    const value = React.useMemo(
        () => ({ lang, setLang, t }),
        [lang, setLang, t],
    );

    return (
        <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    );
}

export function useI18n(): I18nContextValue {
    const ctx = React.useContext(I18nContext);
    if (!ctx) {
        throw new Error("useI18n must be used within <I18nProvider>");
    }
    return ctx;
}

// Non-hook helper (e.g. for non-React code)
export function translate(key: string, lang: Lang): string {
    const dict = dictionaries[lang] || dictionaries.en;
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
        return dict[key] as string;
    }
    const fallback = dictionaries.en?.[key];
    return typeof fallback === "string" ? fallback : key;
}
