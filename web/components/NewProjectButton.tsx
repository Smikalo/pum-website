// ./web/components/NewProjectButton.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";

export default function NewProjectButton() {
    let user: any = null;
    try {
        user = useAuth?.().user ?? null;
    } catch {
        user = null;
    }

    if (!user) return null;

    // Any logged-in member can create a project; backend enforces roles further.
    return (
        <Link href="/projects/new" className="btn-primary text-sm">
            New project
        </Link>
    );
}
