"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { tClient } from "@/lib/i18n-client";

export default function NewEventButton() {
    let user: any = null;
    try {
        // @ts-ignore
        user = useAuth?.().user ?? null;
    } catch {
        user = null;
    }

    if (!user) return null;

    return (
        <Link
            href="/events/new"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg ring-1 ring-white/10 bg-white/10 hover:bg-white/20 transition text-sm"
            title={tClient("events.actions.new.title")}
        >
            <span className="inline-block w-5 h-5 rounded-full bg-white text-black text-center leading-5 font-bold">
                +
            </span>
            <span>{tClient("events.actions.new.label")}</span>
        </Link>
    );
}
