"use client";

import React from "react";
import { useSafeAuth } from "@/lib/auth-helpers";
import { tClient } from "@/lib/i18n-client";
import TopRightButton from "@/components/TopRightButton";

export default function NewBlogButton() {
    const { user } = useSafeAuth();
    if (!user) return null;

    return (
        <TopRightButton href="/blog/new" className="btn-primary text-sm">
            {tClient("blog.actions.newPost")}
        </TopRightButton>
    );
}