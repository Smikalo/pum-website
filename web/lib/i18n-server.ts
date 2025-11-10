// web/lib/i18n-server.ts
import { cookies } from "next/headers";
import en from "@/i18n/en.json";
import de from "@/i18n/de.json";

export type ServerLang = "en" | "de";
type Messages = Record<string, string>;

const dictionaries: Record<ServerLang, Messages> = {
    en: en as Messages,
    de: de as Messages,
};

function getCurrentLang(): ServerLang {
    try {
        const cookieStore = cookies();
        const raw = cookieStore.get("lang")?.value;
        if (raw === "en" || raw === "de") {
            return raw;
        }
    } catch {
        // ignore, fall back to English
    }
    return "en";
}

/**
 * Server-side translation helper. Reads the `lang` cookie when available,
 * falls back to English, and then to the key itself.
 */
export function tServer(key: string): string {
    const lang = getCurrentLang();
    const dict = dictionaries[lang] || dictionaries.en;

    if (Object.prototype.hasOwnProperty.call(dict, key)) {
        return dict[key] as string;
    }

    const fallback = dictionaries.en[key];
    return typeof fallback === "string" ? fallback : key;
}
