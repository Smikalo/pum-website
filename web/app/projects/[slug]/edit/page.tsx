// ./web/app/projects/[slug]/edit/page.tsx
import React from "react";
import type { Metadata } from "next";
import ProjectForm from "@/components/ProjectForm";

export const dynamic = "force-dynamic";

type EditProjectPageProps = {
    params: { slug: string };
};

export async function generateMetadata({ params }: EditProjectPageProps): Promise<Metadata> {
    const slug = params.slug;
    return {
        title: `Edit project – ${slug}`,
        description: "Edit project details, team, and related content.",
    };
}

export default function EditProjectPage({ params }: EditProjectPageProps) {
    return <ProjectForm mode="edit" slug={params.slug} />;
}
