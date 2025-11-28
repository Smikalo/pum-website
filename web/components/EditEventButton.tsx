"use client";

import React from "react";
import { useSafeAuth, getRoles } from "@/lib/auth-helpers";
import { tClient } from "@/lib/i18n-client";
import TopRightButton from "@/components/TopRightButton";

type EditEventButtonProps = {
    slug: string;
    creatorSlug: string | null;
};

export default function EditEventButton({
                                            slug,
                                            creatorSlug,
                                        }: EditEventButtonProps) {
    const { user } = useSafeAuth();

    if (!user) return null;

    const roles = getRoles(user);
    const isAdmin = roles.includes("ADMIN");
    const isModerator = roles.includes("MODERATOR");
    const currentMemberSlug = user.member?.slug ?? null;
    const isCreator = !!creatorSlug && creatorSlug === currentMemberSlug;

    if (!isAdmin && !isModerator && !isCreator) {
        return null;
    }

    return (
        <TopRightButton
            href={`/events/${slug}/edit`}
            className="btn-secondary text-sm"
        >
            {tClient("events.actions.edit")}
        </TopRightButton>
    );
}