"use client";

import React from "react";
import { useSafeAuth, getRoles } from "@/lib/auth-helpers";
import MemberAdminEditor from "@/components/MemberAdminEditor";
import { tClient } from "@/lib/i18n-client";

type EditMemberButtonProps = {
    slug: string;
    /** True if this member belongs to an ADMIN user – must never be editable/deletable from the members page */
    isAdminMember?: boolean | null;
};

export default function EditMemberButton({
                                             slug,
                                             isAdminMember,
                                         }: EditMemberButtonProps) {
    const { user } = useSafeAuth();
    const [open, setOpen] = React.useState(false);

    if (!user) return null;

    const roles = getRoles(user);
    const isAdmin = roles.includes("ADMIN");
    const isModerator = roles.includes("MODERATOR");

    // Only admins/moderators may see the edit button…
    if (!isAdmin && !isModerator) return null;

    // …but *never* for the admin’s own member entry
    if (isAdminMember) return null;

    return (
        <>
            <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setOpen(true)}
            >
                {tClient("members.actions.edit")}
            </button>

            {open && (
                <MemberAdminEditor
                    slug={slug}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}