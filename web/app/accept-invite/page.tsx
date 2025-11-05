"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/config";

function readCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const matches = document.cookie.match(
        new RegExp(
            "(?:^|; )" +
            name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") +
            "=([^;]*)",
        ),
    );
    return matches ? decodeURIComponent(matches[1]) : null;
}

async function ensureCsrf(): Promise<void> {
    await fetch(`${API_BASE}/api/auth/csrf`, {
        method: "GET",
        credentials: "include",
    });
}

type ConsumeResult =
    | {
    ok: true;
    newUser?: boolean;
    eventSlug?: string | null;
    projectSlug?: string | null;
}
    | {
    needsPassword: true;
    email: string;
    eventSlug?: string | null;
    projectSlug?: string | null;
    error?: string;
}
    | {
    ok?: false;
    error?: string;
};

function AcceptInviteInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [state, setState] = React.useState<"loading" | "needsPassword" | "done">("loading");
    const [email, setEmail] = React.useState<string>("");
    const [targetSlug, setTargetSlug] = React.useState<string>("");
    const [targetKind, setTargetKind] = React.useState<"event" | "project" | null>(null);
    const [name, setName] = React.useState<string>("");
    const [password, setPassword] = React.useState<string>("");
    const [passwordRepeat, setPasswordRepeat] = React.useState<string>("");
    const [error, setError] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);

    function redirectFor(result: { eventSlug?: string | null; projectSlug?: string | null }) {
        if (result.projectSlug) return `/projects/${result.projectSlug}`;
        if (result.eventSlug) return `/events/${result.eventSlug}`;
        return "/account";
    }

    function deriveKind(slugs: { eventSlug?: string | null; projectSlug?: string | null }): "event" | "project" | null {
        if (slugs.projectSlug) return "project";
        if (slugs.eventSlug) return "event";
        return null;
    }

    React.useEffect(() => {
        if (!token) {
            setError("Missing invitation token.");
            setState("done");
            return;
        }

        (async () => {
            try {
                setError(null);
                await ensureCsrf();
                const csrf = readCookie("XSRF-TOKEN");

                const res = await fetch(`${API_BASE}/api/auth/invite/consume`, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrf || "",
                    },
                    body: JSON.stringify({ token }),
                });

                const data: ConsumeResult = await res.json();

                if (res.ok && (data as any)?.ok) {
                    const dest = redirectFor(data as any);
                    router.replace(dest);
                    setState("done");
                    return;
                }

                if ((data as any)?.needsPassword) {
                    const d = data as any;
                    setEmail(d.email || "");
                    setTargetSlug(d.projectSlug || d.eventSlug || "");
                    setTargetKind(deriveKind(d));
                    setState("needsPassword");
                    return;
                }

                setError((data as any)?.error || "Invite invalid or expired.");
                setState("done");
            } catch (err: any) {
                setError(err?.message || "Something went wrong.");
                setState("done");
            }
        })();
    }, [token, router]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!token) return;

        setSubmitting(true);
        setError(null);

        try {
            await ensureCsrf();
            const csrf = readCookie("XSRF-TOKEN");

            const res = await fetch(`${API_BASE}/api/auth/invite/consume`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrf || "",
                },
                body: JSON.stringify({
                    token,
                    name,
                    password,
                    passwordRepeat,
                }),
            });

            const data: ConsumeResult = await res.json();

            if (res.ok && (data as any)?.ok) {
                router.replace(redirectFor(data as any));
            } else if ((data as any)?.needsPassword) {
                setError((data as any).error || "Please check your inputs.");
            } else {
                setError((data as any)?.error || "Invite invalid or expired.");
            }
        } catch (err: any) {
            setError(err?.message || "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    }

    if (state === "loading") {
        return (
            <div className="mx-auto max-w-xl px-4 py-12">
                <h1 className="text-2xl font-semibold mb-2">Accepting your invite…</h1>
                <p className="text-white/70 text-sm">
                    We are verifying your invitation link. This usually only takes a moment.
                </p>
            </div>
        );
    }

    if (state === "needsPassword") {
        const thing = targetKind === "project" ? "project" : "event";
        return (
            <div className="mx-auto max-w-xl px-4 py-12">
                <h1 className="text-2xl font-semibold mb-3">Create your account</h1>
                <p className="text-white/70 text-sm mb-6">
                    We found an {thing} invitation for{" "}
                    <span className="font-mono">{email}</span>
                    {targetSlug ? (
                        <>
                            {" "}
                            to <span className="font-semibold">{targetSlug}</span>.
                        </>
                    ) : (
                        "."
                    )}
                    <br />
                    Set your name and password to create your account and join.
                </p>

                {error && (
                    <div className="mb-4 rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1">Full name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm outline-none focus:ring-white/40"
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Password</label>
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm outline-none focus:ring-white/40"
                        />
                        <p className="mt-1 text-xs text-white/50">
                            At least 8 characters.
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Repeat password</label>
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={passwordRepeat}
                            onChange={(e) => setPasswordRepeat(e.target.value)}
                            autoComplete="new-password"
                            className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm outline-none focus:ring-white/40"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg_white/90 disabled:opacity-70"
                        >
                            {submitting ? "Creating account…" : "Create account & join"}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    // state === "done" but we don't have a redirect (error)
    return (
        <div className="mx-auto max-w-xl px-4 py-12">
            <h1 className="text-2xl font-semibold mb-3">Invitation</h1>
            <p className="text-white/70 text-sm">
                {error || "Invite accepted. You can close this window."}
            </p>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense
            fallback={
                <div className="mx-auto max-w-xl px-4 py-12">
                    <h1 className="text-2xl font-semibold mb-2">Accepting your invite…</h1>
                    <p className="text-white/70 text-sm">
                        We are verifying your invitation link. This usually only takes a moment.
                    </p>
                </div>
            }
        >
            <AcceptInviteInner />
        </Suspense>
    );
}
