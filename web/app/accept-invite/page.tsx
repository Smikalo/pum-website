"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/config";
import { useI18n } from "@/context/I18nProvider";

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
    const { t } = useI18n();

    const [state, setState] = React.useState<
        "loading" | "needsPassword" | "done"
    >("loading");
    const [email, setEmail] = React.useState<string>("");
    const [targetSlug, setTargetSlug] = React.useState<string>("");
    const [targetKind, setTargetKind] = React.useState<
        "event" | "project" | null
    >(null);
    const [name, setName] = React.useState<string>("");
    const [password, setPassword] = React.useState<string>("");
    const [passwordRepeat, setPasswordRepeat] = React.useState<string>("");
    const [error, setError] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);

    function redirectFor(result: {
        eventSlug?: string | null;
        projectSlug?: string | null;
    }) {
        if (result.projectSlug) return `/projects/${result.projectSlug}`;
        if (result.eventSlug) return `/events/${result.eventSlug}`;
        return "/account";
    }

    function deriveKind(slugs: {
        eventSlug?: string | null;
        projectSlug?: string | null;
    }): "event" | "project" | null {
        if (slugs.projectSlug) return "project";
        if (slugs.eventSlug) return "event";
        return null;
    }

    React.useEffect(() => {
        if (!token) {
            setError(t("acceptInvite.error.missingToken"));
            setState("done");
            return;
        }

        (async () => {
            try {
                setError(null);
                await ensureCsrf();
                const csrf = readCookie("XSRF-TOKEN");

                const res = await fetch(
                    `${API_BASE}/api/auth/invite/consume`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRF-Token": csrf || "",
                        },
                        body: JSON.stringify({ token }),
                    },
                );

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

                setError(
                    (data as any)?.error ||
                    t("acceptInvite.error.invalidOrExpired"),
                );
                setState("done");
            } catch (err: any) {
                setError(
                    err?.message || t("acceptInvite.error.generic"),
                );
                setState("done");
            }
        })();
        // We deliberately do *not* depend on `t` here to avoid re-consuming
        // invites when the language changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                setError(
                    (data as any).error ||
                    t("acceptInvite.error.checkInputs"),
                );
            } else {
                setError(
                    (data as any)?.error ||
                    t("acceptInvite.error.invalidOrExpired"),
                );
            }
        } catch (err: any) {
            setError(
                err?.message || t("acceptInvite.error.generic"),
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (state === "loading") {
        return (
            <div className="mx-auto max-w-xl px-4 py-12">
                <h1 className="mb-2 text-2xl font-semibold">
                    {t("acceptInvite.loading.title")}
                </h1>
                <p className="text-sm text-white/70">
                    {t("acceptInvite.loading.body")}
                </p>
            </div>
        );
    }

    if (state === "needsPassword") {
        const introKey =
            targetKind === "project"
                ? "acceptInvite.create.intro.projectPrefix"
                : "acceptInvite.create.intro.eventPrefix";

        return (
            <div className="mx-auto max-w-xl px-4 py-12">
                <h1 className="mb-3 text-2xl font-semibold">
                    {t("acceptInvite.create.title")}
                </h1>
                <p className="mb-6 text-sm text-white/70">
                    {t(introKey)}{" "}
                    <span className="font-mono">{email}</span>
                    {targetSlug ? (
                        <>
                            {" "}
                            {t("acceptInvite.create.intro.to")}{" "}
                            <span className="font-semibold">
                                {targetSlug}
                            </span>
                            .
                        </>
                    ) : (
                        "."
                    )}
                    <br />
                    {t("acceptInvite.create.intro.suffix")}
                </p>

                {error && (
                    <div className="mb-4 rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm">
                            {t("acceptInvite.form.fullName.label")}
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-md bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/40"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">
                            {t("acceptInvite.form.password.label")}
                        </label>
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            className="w-full rounded-md bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/40"
                        />
                        <p className="mt-1 text-xs text-white/50">
                            {t("acceptInvite.form.password.helper")}
                        </p>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm">
                            {t(
                                "acceptInvite.form.passwordRepeat.label",
                            )}
                        </label>
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={passwordRepeat}
                            onChange={(e) =>
                                setPasswordRepeat(e.target.value)
                            }
                            autoComplete="new-password"
                            className="w-full rounded-md bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/40"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-70"
                        >
                            {submitting
                                ? t(
                                    "acceptInvite.form.submit.creating",
                                )
                                : t(
                                    "acceptInvite.form.submit.default",
                                )}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    // state === "done" but we don't have a redirect (error or info)
    return (
        <div className="mx-auto max-w-xl px-4 py-12">
            <h1 className="mb-3 text-2xl font-semibold">
                {t("acceptInvite.done.title")}
            </h1>
            <p className="text-sm text-white/70">
                {error || t("acceptInvite.done.message.default")}
            </p>
        </div>
    );
}

export default function AcceptInvitePage() {
    const { t } = useI18n();

    return (
        <Suspense
            fallback={
                <div className="mx-auto max-w-xl px-4 py-12">
                    <h1 className="mb-2 text-2xl font-semibold">
                        {t("acceptInvite.loading.title")}
                    </h1>
                    <p className="text-sm text-white/70">
                        {t("acceptInvite.loading.body")}
                    </p>
                </div>
            }
        >
            <AcceptInviteInner />
        </Suspense>
    );
}
