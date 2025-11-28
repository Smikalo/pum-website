"use client";

import React from "react";
import { useSafeAuth, getRoles } from "@/lib/auth-helpers";
import { tClient } from "@/lib/i18n-client";
import TopRightButton from "@/components/TopRightButton";

type EditProjectButtonProps = {
    slug: string;
    creatorSlug?: string | null;
};

export default function EditProjectButton({
                                              slug,
                                              creatorSlug,
                                          }: EditProjectButtonProps) {
    const { user } = useSafeAuth();

    if (!user) return null;

    const roles = getRoles(user);
    const isAdmin = roles.includes("ADMIN");
    const isModerator = roles.includes("MODERATOR");
    const currentMemberSlug = user.member?.slug ?? null;
    const isCreator =
        !!creatorSlug &&
        !!currentMemberSlug &&
        creatorSlug.toLowerCase() === currentMemberSlug.toLowerCase();

    if (!isAdmin && !isModerator && !isCreator) return null;

    return (
        <TopRightButton
            href={`/projects/${slug}/edit`}
            className="btn-secondary text-sm"
        >
            {tClient("projects.actions.edit")}
        </TopRightButton>
    );
}