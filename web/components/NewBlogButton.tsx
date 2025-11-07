// ./web/components/NewBlogButton.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";

export default function NewBlogButton() {
    // Mirror the defensive pattern from NewProjectButton
    let ctx: any = null;
    try {
        ctx = useAuth?.();
    } catch {
        ctx = null;
    }

    const user = ctx?.user || null;
    if (!user) return null;

    // Any logged-in member can start a new blog post; backend will enforce roles.
    return (
        <Link href="/blog/new" className="btn-primary text-sm">
            New blog post
        </Link>
    );
}
