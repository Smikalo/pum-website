"use client";

import React from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ContactState } from "@/types/contact";

// useFormState/useFormStatus are client hooks — must be used in a Client Component.
// Official docs: they work when the action is passed to the <form> and the hook lives under it.  :contentReference[oaicite:1]{index=1}

export default function ContactForm({
                                        action,
                                    }: {
    action: (prev: ContactState, formData: FormData) => Promise<ContactState>;
}) {
    const [state, formAction] = useFormState<ContactState, FormData>(action, { ok: false });

    return (
        <form action={formAction} className="card p-5 space-y-4" aria-describedby="form-status">
            {/* Accessible error/status area */}
            <div id="form-status" aria-live="polite" className="text-sm">
                {state.message ? (
                    <p className={state.ok ? "text-emerald-300" : "text-rose-300"}>{state.message}</p>
                ) : null}
            </div>

            <div>
                <label htmlFor="name" className="block text-sm mb-1">Your name</label>
                <input
                    id="name" name="name" type="text" required
                    defaultValue={state.fields?.name}
                    className={`w-full rounded-lg bg-white/5 ring-1 ${state.errors?.name ? "ring-rose-400/50" : "ring-white/10"} px-3 py-2`}
                />
                {state.errors?.name && <p className="mt-1 text-xs text-rose-300">{state.errors.name}</p>}
            </div>

            <div>
                <label htmlFor="email" className="block text-sm mb-1">Email</label>
                <input
                    id="email" name="email" type="email" required inputMode="email" autoComplete="email"
                    defaultValue={state.fields?.email}
                    className={`w-full rounded-lg bg-white/5 ring-1 ${state.errors?.email ? "ring-rose-400/50" : "ring-white/10"} px-3 py-2`}
                />
                {state.errors?.email && <p className="mt-1 text-xs text-rose-300">{state.errors.email}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="role" className="block text-sm mb-1">You are</label>
                    <select
                        id="role" name="role" required defaultValue={state.fields?.role || ""}
                        className={`w-full rounded-lg bg-white/5 ring-1 ${state.errors?.role ? "ring-rose-400/50" : "ring-white/10"} px-3 py-2`}
                    >
                        <option value="" disabled>Select</option>
                        <option value="recruiter">Recruiter</option>
                        <option value="new-member">New member</option>
                        <option value="sponsor-client">Sponsor / Client</option>
                        <option value="other">Other</option>
                    </select>
                    {state.errors?.role && <p className="mt-1 text-xs text-rose-300">{state.errors.role}</p>}
                </div>

                <div>
                    <label htmlFor="topic" className="block text-sm mb-1">Interested in</label>
                    <select
                        id="topic" name="topic" required defaultValue={state.fields?.topic || ""}
                        className={`w-full rounded-lg bg-white/5 ring-1 ${state.errors?.topic ? "ring-rose-400/50" : "ring-white/10"} px-3 py-2`}
                    >
                        <option value="" disabled>Select</option>
                        <option value="join">Joining PUM</option>
                        <option value="collaborate">Collaboration / project</option>
                        <option value="recruit">Recruiting our members</option>
                        <option value="press">Press / speaking</option>
                    </select>
                    {state.errors?.topic && <p className="mt-1 text-xs text-rose-300">{state.errors.topic}</p>}
                </div>
            </div>

            <div>
                <label htmlFor="message" className="block text-sm mb-1">Message</label>
                <textarea
                    id="message" name="message" rows={6} required
                    defaultValue={state.fields?.message}
                    className={`w-full rounded-lg bg-white/5 ring-1 ${state.errors?.message ? "ring-rose-400/50" : "ring-white/10"} px-3 py-2`}
                />
                {state.errors?.message && <p className="mt-1 text-xs text-rose-300">{state.errors.message}</p>}
            </div>

            {/* Subscribe + honeypot */}
            <div className="flex items-center gap-3">
                <input id="subscribe" name="subscribe" type="checkbox" className="accent-cyan-300" />
                <label htmlFor="subscribe" className="text-sm">Subscribe to blog updates</label>
            </div>
            <div aria-hidden className="hidden">
                <label>
                    Website <input type="text" name="website" autoComplete="off" tabIndex={-1} />
                </label>
            </div>

            <div className="pt-2">
                <SubmitButton />
            </div>
        </form>
    );
}

function SubmitButton() {
    const { pending } = useFormStatus(); // must be a descendant of <form>  :contentReference[oaicite:2]{index=2}
    return (
        <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold ring-1 ring-white/10 hover:opacity-90 disabled:opacity-60"
            disabled={pending}
        >
            {pending ? (
                <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity=".25"/>
                        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    </svg>
                    Sending…
                </>
            ) : (
                <>Send message</>
            )}
        </button>
    );
}
