"use client";

import Link from "next/link";
import { useSafeAuth, getRoles } from "@/lib/auth-helpers";
import { tClient } from "@/lib/i18n-client";

type Props = {
    slug: string;
    authorSlugs: string[];
    className?: string;
};

export function EditBlogButton({ slug, authorSlugs, className }: Props) {
    const { user } = useSafeAuth();

    if (!user) {
        return null;
    }

    const roles = getRoles(user);
    const upperRoles = roles
        .filter((r): r is string => typeof r === "string")
        .map((r) => r.toUpperCase());

    const currentMemberSlug = user.member?.slug ?? null;

    const authorSlugsNorm = (authorSlugs || []).map((s) =>
        (s || "").trim().toLowerCase(),
    );
    const currentSlugNorm = currentMemberSlug
        ? currentMemberSlug.trim().toLowerCase()
        : null;

    const isAdminOrModerator = upperRoles.some(
        (r) => r === "ADMIN" || r === "MODERATOR",
    );
    const isAuthor =
        !!currentSlugNorm && authorSlugsNorm.includes(currentSlugNorm);

    const shouldShow = isAdminOrModerator || isAuthor;

    if (!shouldShow) return null;

    const handleClick = () => {
        // logging if needed
    };

    return (
        <Link
            href={`/blog/${slug}/edit`}
            onClick={handleClick}
            className={
                className ||
                "inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            }
        >
            {tClient("common.edit")}
        </Link>
    );
}