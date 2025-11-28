"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/config";
import { useI18n } from "@/context/I18nProvider";
import { getCsrfToken } from "@/lib/csrf";

type ProjectEventSlugs = {
    eventSlug?: string | null;
    projectSlug?: string | null;
};

type ConsumeSuccessResult = ProjectEventSlugs & {
    ok: true;
    newUser?: boolean;
    email?: string;
    error?: string;
};

type ConsumeErrorBase = ProjectEventSlugs & {
    ok: false;
    error?: string;
};

type ConsumeNeedsPasswordResult = ConsumeErrorBase & {
    needsPassword: true;
    email: string;
};

type ConsumeNeedsNameResult = ConsumeErrorBase & {
    needsName: true;
    email: string;
};

type ConsumeGenericErrorResult = ConsumeErrorBase & {
    needsPassword?: false;
    needsName?: false;
};

type ConsumeResult =
    | ConsumeSuccessResult
    | ConsumeNeedsPasswordResult
    | ConsumeNeedsNameResult
    | ConsumeGenericErrorResult;

function AcceptInviteInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";
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

    function redirectFor(slugs: ProjectEventSlugs) {
        if (slugs.projectSlug) return `/projects/${slugs.projectSlug}`;
        if (slugs.eventSlug) return `/events/${slugs.eventSlug}`;
        return "/account";
    }

    function deriveKind(slugs: ProjectEventSlugs): "event" | "project" | null {
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
                const csrf = await getCsrfToken();

                const res = await fetch(
                    `${API_BASE}/api/auth/invite/consume`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRF-Token": csrf,
                        },
                        body: JSON.stringify({ token }),
                    },
                );

                const data: ConsumeResult = await res.json();

                if (res.ok && data.ok) {
                    const dest = redirectFor({
                        projectSlug: data.projectSlug ?? null,
                        eventSlug: data.eventSlug ?? null,
                    });
                    router.replace(dest);
                    setState("done");
                    return;
                }

                if ("needsPassword" in data && data.needsPassword) {
                    setEmail(data.email);
                    const slugs: ProjectEventSlugs = {
                        projectSlug: data.projectSlug ?? null,
                        eventSlug: data.eventSlug ?? null,
                    };
                    setTargetSlug(
                        slugs.projectSlug ??
                        slugs.eventSlug ??
                        "",
                    );
                    setTargetKind(deriveKind(slugs));
                    setState("needsPassword");
                    return;
                }

                setError(
                    data.error ??
                    t("acceptInvite.error.invalidOrExpired"),
                );
                setState("done");
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : t("acceptInvite.error.generic");
                setError(message);
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
            const csrf = await getCsrfToken();

            const res = await fetch(
                `${API_BASE}/api/auth/invite/consume`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrf,
                    },
                    body: JSON.stringify({
                        token,
                        name,
                        password,
                        passwordRepeat,
                    }),
                },
            );

            const data: ConsumeResult = await res.json();

            if (res.ok && data.ok) {
                const dest = redirectFor({
                    projectSlug: data.projectSlug ?? null,
                    eventSlug: data.eventSlug ?? null,
                });
                router.replace(dest);
            } else if (
                "needsPassword" in data &&
                data.needsPassword
            ) {
                setError(
                    data.error ??
                    t("acceptInvite.error.checkInputs"),
                );
            } else {
                setError(
                    data.error ??
                    t("acceptInvite.error.invalidOrExpired"),
                );
            }
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : t("acceptInvite.error.generic");
            setError(message);
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