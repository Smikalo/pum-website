// app/newsletter/unsubscribe/page.tsx
import React from "react";
import { API_BASE } from "@/lib/config";
import { tServer } from "@/lib/i18n-server";

type UnsubResult =
    | { state: "idle" | "missing-token" }
    | { state: "success"; message: string }
    | { state: "error"; message: string };

async function unsubscribeWithToken(token: string | null): Promise<UnsubResult> {
    if (!token) {
        return {
            state: "missing-token",
        };
    }

    try {
        const res = await fetch(`${API_BASE}/api/newsletter/unsubscribe`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token }),
            cache: "no-store",
        });

        if (!res.ok) {
            let msg = tServer("newsletter.unsubscribe.error.generic");
            try {
                const body = await res.json();
                if (body?.error && typeof body.error === "string") {
                    msg = body.error;
                }
            } catch {
                // ignore JSON error, keep default message
            }
            return { state: "error", message: msg };
        }

        const body = await res.json().catch(() => null);
        return {
            state: "success",
            message:
                (body?.message as string | undefined) ||
                tServer("newsletter.unsubscribe.success.defaultMessage"),
        };
    } catch {
        return {
            state: "error",
            message: tServer("newsletter.unsubscribe.error.network"),
        };
    }
}

export default async function NewsletterUnsubscribePage({
                                                            searchParams,
                                                        }: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const tokenParam = searchParams.token;
    const token =
        typeof tokenParam === "string"
            ? tokenParam
            : Array.isArray(tokenParam)
                ? tokenParam[0]
                : null;

    const result = await unsubscribeWithToken(token);

    let title = tServer("newsletter.unsubscribe.title.default");
    let description = "";
    let toneClass = "text-white/70";
    let badge: React.ReactNode = null;

    if (result.state === "missing-token") {
        title = tServer("newsletter.unsubscribe.missingToken.title");
        description = tServer("newsletter.unsubscribe.missingToken.description");
        toneClass = "text-amber-300";
        badge = (
            <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/40 px-2 py-0.5 text-xs text-amber-200 mb-3">
                {tServer("newsletter.unsubscribe.missingToken.badge")}
            </span>
        );
    } else if (result.state === "success") {
        title = tServer("newsletter.unsubscribe.success.title");
        description = result.message;
        toneClass = "text-emerald-300";
        badge = (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/40 px-2 py-0.5 text-xs text-emerald-200 mb-3">
                {tServer("newsletter.unsubscribe.success.badge")}
            </span>
        );
    } else if (result.state === "error") {
        title = tServer("newsletter.unsubscribe.error.title");
        description = result.message;
        toneClass = "text-rose-300";
        badge = (
            <span className="inline-flex items-center rounded-full bg-rose-500/10 border border-rose-500/40 px-2 py-0.5 text-xs text-rose-200 mb-3">
                {tServer("newsletter.unsubscribe.error.badge")}
            </span>
        );
    }

    return (
        <section className="section">
            <div className="max-w-xl">
                <p className="kicker">{tServer("newsletter.kicker")}</p>
                <h1 className="display mb-3">{title}</h1>
                {badge}
                <p className={`${toneClass} mb-6`}>{description}</p>

                <p className="text-sm text-white/50">
                    {tServer("newsletter.unsubscribe.footer.note")}
                </p>
            </div>
        </section>
    );
}
