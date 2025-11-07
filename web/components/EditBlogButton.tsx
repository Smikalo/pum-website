"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";

type Props = {
    slug: string;
    authorSlugs: string[];
    className?: string;
};

export function EditBlogButton({ slug, authorSlugs, className }: Props) {
    const { user } = useAuth();

    if (!user) {
        console.log("[EditBlogButton] rendering (no user)", {
            slug,
            authorSlugs,
        });
        return null;
    }

    const rawRoles = Array.isArray(user.roles) ? user.roles : [];
    const upperRoles = rawRoles
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

    console.log("[EditBlogButton] rendering", {
        slug,
        rawUser: user,
        rawUserRoles: rawRoles,
        authorSlugs,
    });

    console.log("[EditBlogButton] permission check", {
        slug,
        currentMemberSlug,
        authorSlugsNorm,
        rawRoles,
        upperRoles,
        isAdminOrModerator,
        isAuthor,
        shouldShow,
    });

    if (!shouldShow) return null;

    const handleClick = () => {
        console.log("[EditBlogButton] clicked", {
            slug,
            currentMemberSlug,
            upperRoles,
        });
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
            Edit
        </Link>
    );
}
