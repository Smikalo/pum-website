// app/newsletter/verify/page.tsx
import React from "react";
import { redirect } from "next/navigation";
import { API_BASE } from "@/lib/config";

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
                error: json.error || "Verification failed.",
                code: json.code,
            };
        }
        return {
            ok: true,
            status: json.status,
            email: json.email,
        };
    } catch (err) {
        console.error("[newsletter/verify] request failed", err);
        return {
            ok: false,
            error: "Unable to reach verification server. Please try again later.",
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
        // no token – redirect to home or show a friendly error
        return redirect("/");
    }

    const result = await verifyToken(token);

    const title = result.ok
        ? result.status === "already-verified"
            ? "You’re already subscribed ✨"
            : "Subscription confirmed 🎉"
        : "Couldn’t verify your subscription";

    const message = result.ok
        ? result.status === "already-verified"
            ? `Looks like you’ve already confirmed ${result.email || "your email"}. You’re all set!`
            : `Thanks${
                result.email ? `, ${result.email}` : ""
            }! Your subscription is now confirmed.`
        : result.error || "Something went wrong with the verification link.";

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">NEWSLETTER</p>
                <h1 className="display">{title}</h1>
                <p className="mt-3 text-white/70 max-w-2xl">{message}</p>
            </header>

            <div className="card p-5 space-y-3">
                {result.ok ? (
                    <>
                        <p className="text-sm text-white/70">
                            You’ll receive occasional updates from PUM about new projects, events, and posts.
                        </p>
                    </>
                ) : (
                    <>
                        {result.code === "TOKEN_EXPIRED" ? (
                            <p className="text-sm text-white/70">
                                This verification link has expired. Try subscribing again so we can send you a fresh link.
                            </p>
                        ) : (
                            <p className="text-sm text-white/70">
                                The link might be invalid or already used. If you copied it manually, double-check the URL.
                            </p>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
