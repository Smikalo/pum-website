"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { tClient } from "@/lib/i18n-client";

export default function NewBlogButton() {
    let ctx: any = null;
    try {
        ctx = useAuth?.();
    } catch {
        ctx = null;
    }

    const user = ctx?.user || null;
    if (!user) return null;

    return (
        <Link href="/blog/new" className="btn-primary text-sm">
            {tClient("blog.actions.newPost")}
        </Link>
    );
}
