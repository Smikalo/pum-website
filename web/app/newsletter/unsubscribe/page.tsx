// app/newsletter/unsubscribe/page.tsx
import React from "react";
import { API_BASE } from "@/lib/config";

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
            let msg = "Unsubscribe failed.";
            try {
                const body = await res.json();
                if (body?.error) msg = body.error;
            } catch {
                // ignore JSON error, keep default message
            }
            return { state: "error", message: msg };
        }

        const body = await res.json().catch(() => null);
        return {
            state: "success",
            message: body?.message || "You’ve been unsubscribed from updates.",
        };
    } catch (err) {
        // console.error("[unsubscribe] request failed", err);
        return {
            state: "error",
            message: "We couldn’t reach the server. Please try again later.",
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
        typeof tokenParam === "string" ? tokenParam : Array.isArray(tokenParam) ? tokenParam[0] : null;

    const result = await unsubscribeWithToken(token);

    let title = "Unsubscribe from updates";
    let description = "";
    let toneClass = "text-white/70";
    let badge = null as React.ReactNode;

    if (result.state === "missing-token") {
        title = "Missing unsubscribe token";
        description =
            "The link you used is missing a token. Please open the latest email from us and click the unsubscribe link again.";
        toneClass = "text-amber-300";
        badge = (
            <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/40 px-2 py-0.5 text-xs text-amber-200 mb-3">
        Action needed
      </span>
        );
    } else if (result.state === "success") {
        title = "You’re unsubscribed";
        description = result.message;
        toneClass = "text-emerald-300";
        badge = (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/40 px-2 py-0.5 text-xs text-emerald-200 mb-3">
        Success
      </span>
        );
    } else if (result.state === "error") {
        title = "We couldn’t unsubscribe you";
        description = result.message;
        toneClass = "text-rose-300";
        badge = (
            <span className="inline-flex items-center rounded-full bg-rose-500/10 border border-rose-500/40 px-2 py-0.5 text-xs text-rose-200 mb-3">
        Error
      </span>
        );
    }

    return (
        <section className="section">
            <div className="max-w-xl">
                <p className="kicker">NEWSLETTER</p>
                <h1 className="display mb-3">{title}</h1>
                {badge}
                <p className={`${toneClass} mb-6`}>{description}</p>

                <p className="text-sm text-white/50">
                    If this wasn’t you, you can ignore this page. You’ll only stop receiving emails sent to the
                    address that clicked this link.
                </p>
            </div>
        </section>
    );
}
