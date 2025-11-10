// web/app/projects/new/page.tsx
import React from "react";
import type { Metadata } from "next";
import ProjectForm from "@/components/ProjectForm";
import { tServer } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: tServer("projects.new.metadata.title"),
        description: tServer("projects.new.metadata.description"),
    };
}

export default function NewProjectPage() {
    return <ProjectForm mode="create" />;
}
