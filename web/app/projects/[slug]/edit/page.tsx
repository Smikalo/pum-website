// web/app/projects/[slug]/edit/page.tsx
import React from "react";
import type { Metadata } from "next";
import ProjectForm from "@/components/ProjectForm";
import { tServer } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

type EditProjectPageProps = {
    params: { slug: string };
};

export async function generateMetadata({
                                           params,
                                       }: EditProjectPageProps): Promise<Metadata> {
    const slug = params.slug;
    return {
        title: tServer("projects.edit.metadata.title").replace("{slug}", slug),
        description: tServer("projects.edit.metadata.description"),
    };
}

export default function EditProjectPage({ params }: EditProjectPageProps) {
    return <ProjectForm mode="edit" slug={params.slug} />;
}
