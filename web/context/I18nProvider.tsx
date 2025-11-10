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
const COOKIE_KEY = "lang";

function readLangCookie(): Lang | null {
    if (typeof document === "undefined") return null;

    try {
        const match = document.cookie.match(
            /(?:^|;\s*)lang=([^;]+)/i,
        );
        const raw = match ? decodeURIComponent(match[1]) : null;
        if (raw === "en" || raw === "de") return raw;
    } catch {
        // ignore
    }
    return null;
}

function writeLangCookie(lang: Lang) {
    if (typeof document === "undefined") return;
    try {
        const maxAge = 60 * 60 * 24 * 365; // 1 year
        document.cookie = `${COOKIE_KEY}=${encodeURIComponent(
            lang,
        )}; path=/; max-age=${maxAge}; samesite=lax`;
    } catch {
        // ignore
    }
}

function detectInitialLang(): Lang {
    // On the server we can't read cookies or navigator reliably, so default to English.
    if (typeof window === "undefined") {
        return "en";
    }

    // 1) Cookie
    const cookieLang = readLangCookie();
    if (cookieLang) return cookieLang;

    // 2) localStorage
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "en" || stored === "de") return stored;
    } catch {
        // ignore
    }

    // 3) Browser UI language
    try {
        const navLang =
            (window.navigator.languages &&
                window.navigator.languages[0]) ||
            window.navigator.language;

        if (navLang && navLang.toLowerCase().startsWith("de")) {
            return "de";
        }
    } catch {
        // ignore
    }

    // 4) Fallback
    return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLang] = React.useState<Lang>(detectInitialLang);

    // Keep cookie, localStorage, <html lang> and legacy event in sync
    React.useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(STORAGE_KEY, lang);
            } catch {
                // ignore
            }

            writeLangCookie(lang);

            // Legacy custom event for any existing listeners
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
        [lang, t],
    );

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
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
