// ./web/app/projects/new/page.tsx
import React from "react";
import type { Metadata } from "next";
import ProjectForm from "@/components/ProjectForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "New project – PUM",
    description: "Create a new project, add your team, and connect it to events and blog posts.",
};

export default function NewProjectPage() {
    return <ProjectForm mode="create" />;
}
