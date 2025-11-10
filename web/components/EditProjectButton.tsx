// ./web/components/EditProjectButton.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { tClient } from "@/lib/i18n-client";

type EditProjectButtonProps = {
    slug: string;
    creatorSlug?: string | null;
};

export default function EditProjectButton({
                                              slug,
                                              creatorSlug,
                                          }: EditProjectButtonProps) {
    let ctx: any = null;
    try {
        ctx = useAuth?.();
    } catch {
        ctx = null;
    }

    const user = ctx?.user || null;
    if (!user) return null;

    const roles: string[] = Array.isArray(user.roles)
        ? user.roles
        : Array.isArray(user.roleNames)
            ? user.roleNames
            : [];

    const isAdmin = roles.includes("ADMIN");
    const isModerator = roles.includes("MODERATOR");
    const currentMemberSlug = user.member?.slug || null;
    const isCreator =
        !!creatorSlug &&
        !!currentMemberSlug &&
        creatorSlug.toLowerCase() === currentMemberSlug.toLowerCase();

    if (!isAdmin && !isModerator && !isCreator) return null;

    return (
        <Link
            href={`/projects/${slug}/edit`}
            className="btn-secondary text-sm"
        >
            {tClient("projects.actions.edit")}
        </Link>
    );
}
