"use client";

import React from "react";
import { useSafeAuth } from "@/lib/auth-helpers";
import { tClient } from "@/lib/i18n-client";
import TopRightButton from "@/components/TopRightButton";

export default function NewProjectButton() {
    const { user } = useSafeAuth();
    if (!user) return null;

    return (
        <TopRightButton href="/projects/new" className="btn-primary text-sm">
            {tClient("projects.actions.new")}
        </TopRightButton>
    );
}