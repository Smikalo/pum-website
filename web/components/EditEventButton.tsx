"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";

type EditEventButtonProps = {
    slug: string;
    creatorSlug: string | null;
};

export default function EditEventButton({ slug, creatorSlug }: EditEventButtonProps) {
    const { user } = useAuth();

    if (!user) return null;

    const roles = user.roles || [];
    const isAdmin = roles.includes("ADMIN");
    const isModerator = roles.includes("MODERATOR");
    const currentMemberSlug = user.member?.slug ?? null;
    const isCreator = !!creatorSlug && creatorSlug === currentMemberSlug;

    if (!isAdmin && !isModerator && !isCreator) {
        return null;
    }

    return (
        <Link href={`/events/${slug}/edit`} className="btn-secondary text-sm">
            Edit event
        </Link>
    );
}
