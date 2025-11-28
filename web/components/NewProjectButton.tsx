"use client";

import React from "react";
import Link from "next/link";
import { useSafeAuth } from "@/lib/auth-helpers";
import { tClient } from "@/lib/i18n-client";

export default function NewProjectButton() {
    const { user } = useSafeAuth();
    if (!user) return null;

    return (
        <Link href="/projects/new" className="btn-primary text-sm">
            {tClient("projects.actions.new")}
        </Link>
    );
}