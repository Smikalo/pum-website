"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { tClient } from "@/lib/i18n-client";

export default function NewBlogButton() {
    const { user } = useAuth();
    if (!user) return null;

    return (
        <Link href="/blog/new" className="btn-primary text-sm">
            {tClient("blog.actions.newPost")}
        </Link>
    );
}
