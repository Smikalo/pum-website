"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { tClient } from "@/lib/i18n-client";

export default function NewProjectButton() {
    let user: any = null;
    try {
        user = useAuth?.().user ?? null;
    } catch {
        user = null;
    }

    if (!user) return null;

    return (
        <Link href="/projects/new" className="btn-primary text-sm">
            {tClient("projects.actions.new")}
        </Link>
    );
}
