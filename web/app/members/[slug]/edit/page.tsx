"use client";

import React from "react";
import { useRouter } from "next/navigation";
import MemberAdminEditor from "@/components/MemberAdminEditor";

type PageProps = {
    params: { slug: string };
};

export default function EditMemberPage({ params }: PageProps) {
    const router = useRouter();
    const { slug } = params;

    return (
        <MemberAdminEditor
            slug={slug}
            onClose={() => router.push(`/members/${slug}`)}
        />
    );
}
