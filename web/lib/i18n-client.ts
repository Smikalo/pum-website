// web/lib/i18n-client.ts
"use client";

import en from "@/i18n/en.json";
import de from "@/i18n/de.json";

export type ClientLang = "en" | "de";
type Messages = Record<string, string>;

const dictionaries: Record<ClientLang, Messages> = {
    en: en as Messages,
    de: de as Messages,
};

function getCurrentLangClient(): ClientLang {
    // Single source of truth on the client: the `lang` cookie.
    if (typeof document === "undefined") return "en";
    try {
        const m = document.cookie.match(
            /(?:^|;\s*)lang=([^;]+)/i,
        );
        const raw = m ? decodeURIComponent(m[1]) : null;
        if (raw === "en" || raw === "de") return raw;
    } catch {
        // ignore and fall back
    }
    return "en";
}

/**
 * Client-side translation helper.
 * Reads `lang` cookie on the client, falls back to English, then to the key.
 */
export function tClient(key: string): string {
    const lang = getCurrentLangClient();
    const dict = dictionaries[lang] || dictionaries.en;

    if (Object.prototype.hasOwnProperty.call(dict, key)) {
        return dict[key] as string;
    }

    const fallback = dictionaries.en[key];
    return typeof fallback === "string" ? fallback : key;
}
