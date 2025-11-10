"use client";

import React from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ContactState } from "@/types/contact";
import { tClient } from "@/lib/i18n-client";

export default function ContactForm({
                                        action,
                                    }: {
    action: (prev: ContactState, formData: FormData) => Promise<ContactState>;
}) {
    const [state, formAction] = useFormState<ContactState, FormData>(action, {
        ok: false,
    });

    return (
        <form
            action={formAction}
            className="card p-5 space-y-4"
            aria-describedby="form-status"
        >
            {/* Accessible error/status area */}
            <div id="form-status" aria-live="polite" className="text-sm">
                {state.message ? (
                    <p
                        className={
                            state.ok ? "text-emerald-300" : "text-rose-300"
                        }
                    >
                        {state.message}
                    </p>
                ) : null}
            </div>

            <div>
                <label htmlFor="name" className="block text-sm mb-1">
                    {tClient("contact.form.name.label")}
                </label>
                <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    defaultValue={state.fields?.name}
                    className={`w-full rounded-lg bg-white/5 ring-1 ${
                        state.errors?.name
                            ? "ring-rose-400/50"
                            : "ring-white/10"
                    } px-3 py-2`}
                />
                {state.errors?.name && (
                    <p className="mt-1 text-xs text-rose-300">
                        {state.errors.name}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="email" className="block text-sm mb-1">
                    {tClient("contact.form.email.label")}
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    defaultValue={state.fields?.email}
                    className={`w-full rounded-lg bg-white/5 ring-1 ${
                        state.errors?.email
                            ? "ring-rose-400/50"
                            : "ring-white/10"
                    } px-3 py-2`}
                />
                {state.errors?.email && (
                    <p className="mt-1 text-xs text-rose-300">
                        {state.errors.email}
                    </p>
                )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="role" className="block text-sm mb-1">
                        {tClient("contact.form.role.label")}
                    </label>
                    <select
                        id="role"
                        name="role"
                        required
                        defaultValue={state.fields?.role || ""}
                        className={`w-full rounded-lg bg-white/5 ring-1 ${
                            state.errors?.role
                                ? "ring-rose-400/50"
                                : "ring-white/10"
                        } px-3 py-2`}
                    >
                        <option value="" disabled>
                            {tClient("contact.form.role.placeholder")}
                        </option>
                        <option value="recruiter">
                            {tClient("contact.form.role.recruiter")}
                        </option>
                        <option value="new-member">
                            {tClient("contact.form.role.newMember")}
                        </option>
                        <option value="sponsor-client">
                            {tClient("contact.form.role.sponsorClient")}
                        </option>
                        <option value="other">
                            {tClient("contact.form.role.other")}
                        </option>
                    </select>
                    {state.errors?.role && (
                        <p className="mt-1 text-xs text-rose-300">
                            {state.errors.role}
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="topic" className="block text-sm mb-1">
                        {tClient("contact.form.topic.label")}
                    </label>
                    <select
                        id="topic"
                        name="topic"
                        required
                        defaultValue={state.fields?.topic || ""}
                        className={`w-full rounded-lg bg-white/5 ring-1 ${
                            state.errors?.topic
                                ? "ring-rose-400/50"
                                : "ring-white/10"
                        } px-3 py-2`}
                    >
                        <option value="" disabled>
                            {tClient("contact.form.topic.placeholder")}
                        </option>
                        <option value="join">
                            {tClient("contact.form.topic.join")}
                        </option>
                        <option value="collaborate">
                            {tClient("contact.form.topic.collaborate")}
                        </option>
                        <option value="recruit">
                            {tClient("contact.form.topic.recruit")}
                        </option>
                        <option value="press">
                            {tClient("contact.form.topic.press")}
                        </option>
                    </select>
                    {state.errors?.topic && (
                        <p className="mt-1 text-xs text-rose-300">
                            {state.errors.topic}
                        </p>
                    )}
                </div>
            </div>

            <div>
                <label htmlFor="message" className="block text-sm mb-1">
                    {tClient("contact.form.message.label")}
                </label>
                <textarea
                    id="message"
                    name="message"
                    rows={6}
                    required
                    defaultValue={state.fields?.message}
                    className={`w-full rounded-lg bg-white/5 ring-1 ${
                        state.errors?.message
                            ? "ring-rose-400/50"
                            : "ring-white/10"
                    } px-3 py-2`}
                />
                {state.errors?.message && (
                    <p className="mt-1 text-xs text-rose-300">
                        {state.errors.message}
                    </p>
                )}
            </div>

            {/* Subscribe + honeypot */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <input
                        id="subscribe"
                        name="subscribe"
                        type="checkbox"
                        className="accent-cyan-300 emoji-stable"
                    />
                    <label htmlFor="subscribe" className="text-sm">
                        {tClient("contact.form.subscribe.label")}
                    </label>
                </div>
                <p className="text-xs text-white/50">
                    {tClient("contact.form.subscribe.helper")}
                </p>
            </div>

            {/* Hidden honeypot field (bots tend to fill this) */}
            <div aria-hidden className="hidden">
                <label>
                    {tClient("contact.form.honeypot.label")}{" "}
                    <input
                        type="text"
                        name="website"
                        autoComplete="off"
                        tabIndex={-1}
                    />
                </label>
            </div>

            <div className="pt-2">
                <SubmitButton />
            </div>
        </form>
    );
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold ring-1 ring-white/10 hover:opacity-90 disabled:opacity-60"
            disabled={pending}
        >
            {pending ? (
                <>
                    <svg
                        className="animate-spin"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        aria-hidden
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            opacity=".25"
                        />
                        <path
                            d="M22 12a10 10 0 0 1-10 10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                        />
                    </svg>
                    {tClient("contact.form.submit.sending")}
                </>
            ) : (
                <>{tClient("contact.form.submit.label")}</>
            )}
        </button>
    );
}
