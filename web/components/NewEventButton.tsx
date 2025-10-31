"use client";

import Link from "next/link";
// If your project exposes an auth hook/context, import it here.
// Adjust the import path to match your codebase.
import { useAuth } from "@/context/AuthProvider"; // ⬅️ if your hook lives elsewhere, update this path.

export default function NewEventButton() {
    // Fallback: if your app doesn’t have a useAuth hook yet, you can temporarily render nothing.
    let user: any = null;
    try {
        // @ts-ignore – swallow if context is not wired yet
        user = useAuth?.().user ?? null;
    } catch {
        user = null;
    }

    if (!user) return null;

    return (
        <Link
            href="/events/new"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg ring-1 ring-white/10 bg-white/10 hover:bg-white/20 transition text-sm"
            title="Create a new event"
        >
            <span className="inline-block w-5 h-5 rounded-full bg-white text-black text-center leading-5 font-bold">+</span>
            <span>New event</span>
        </Link>
    );
}
