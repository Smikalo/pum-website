// app/newsletter/verify/page.tsx
import React from "react";
import { redirect } from "next/navigation";
import { API_BASE } from "@/lib/config";
import { tServer } from "@/lib/i18n-server";

type VerifyResult = {
    ok: boolean;
    status?: "verified" | "already-verified";
    email?: string;
    error?: string;
    code?: string;
};

async function verifyToken(token: string): Promise<VerifyResult> {
    try {
        const res = await fetch(`${API_BASE}/api/newsletter/verify`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token }),
            cache: "no-store",
        });

        const json = await res.json();
        if (!res.ok) {
            return {
                ok: false,
                error:
                    (json.error as string | undefined) ||
                    tServer("newsletter.verify.error.generic"),
                code: json.code,
            };
        }
        return {
            ok: true,
            status: json.status,
            email: json.email,
        };
    } catch {
        return {
            ok: false,
            error: tServer("newsletter.verify.error.network"),
        };
    }
}

export default async function NewsletterVerifyPage({
                                                       searchParams,
                                                   }: {
    searchParams?: { token?: string };
}) {
    const token = searchParams?.token;
    if (!token) {
        return redirect("/");
    }

    const result = await verifyToken(token);

    const title = result.ok
        ? result.status === "already-verified"
            ? tServer("newsletter.verify.title.alreadyVerified")
            : tServer("newsletter.verify.title.verified")
        : tServer("newsletter.verify.title.error");

    const message = result.ok
        ? result.status === "already-verified"
            ? tServer("newsletter.verify.message.alreadyVerified").replace(
                "{email}",
                result.email || tServer("newsletter.verify.message.emailFallback"),
            )
            : tServer("newsletter.verify.message.verified").replace(
                "{email}",
                result.email || tServer("newsletter.verify.message.emailFallback"),
            )
        : result.error || tServer("newsletter.verify.error.generic");

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">{tServer("newsletter.kicker")}</p>
                <h1 className="display">{title}</h1>
                <p className="mt-3 text-white/70 max-w-2xl">{message}</p>
            </header>

            <div className="card p-5 space-y-3">
                {result.ok ? (
                    <>
                        <p className="text-sm text-white/70">
                            {tServer("newsletter.verify.body.success")}
                        </p>
                    </>
                ) : (
                    <>
                        {result.code === "TOKEN_EXPIRED" ? (
                            <p className="text-sm text-white/70">
                                {tServer("newsletter.verify.body.expired")}
                            </p>
                        ) : (
                            <p className="text-sm text-white/70">
                                {tServer("newsletter.verify.body.invalid")}
                            </p>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
