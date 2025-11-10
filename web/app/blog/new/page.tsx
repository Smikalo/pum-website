export const dynamic = "force-dynamic";
export const revalidate = 0;
export const dynamicParams = true;

// app/blog/new/page.tsx

import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { API_BASE } from "@/lib/config";
import { uploadBlogPhoto } from "@/lib/actions";
import BlogEditorForm from "@/components/BlogEditorForm";
import { tServer } from "@/lib/i18n-server";

function parseCsv(formData: FormData, key: string): string[] {
    const values = formData.getAll(key);
    const out: string[] = [];
    for (const v of values) {
        if (!v) continue;
        const parts = v.toString().split(",");
        for (const raw of parts) {
            const s = raw.trim();
            if (s && !out.includes(s)) out.push(s);
        }
    }
    return out;
}

function isNonEmptyFileLike(value: unknown): value is File {
    if (!value) return false;
    const file = value as any;

    if (typeof file.arrayBuffer !== "function") return false;

    const size = file.size;
    if (typeof size === "number" && size <= 0) {
        return false;
    }

    return true;
}

async function createBlog(formData: FormData) {
    "use server";

    const cookieStore = cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
        redirect("/account");
    }

    const title = (formData.get("title") || "").toString().trim();
    const summary = (formData.get("summary") || "").toString().trim();
    const content = (formData.get("content") || "").toString().trim();
    const tags = parseCsv(formData, "tags");
    const techStack = parseCsv(formData, "techStack");
    const projectSlugs = parseCsv(formData, "projectSlugs");
    const eventSlugs = parseCsv(formData, "eventSlugs");
    const authorSlugs = parseCsv(formData, "authorSlugs");
    const publishedAtRaw = (formData.get("publishedAt") || "")
        .toString()
        .trim();

    if (!title) {
        throw new Error("Title is required");
    }

    const headerNewIndexRaw = (formData.get("headerNewIndex") || "")
        .toString()
        .trim();
    const headerNewIndex = headerNewIndexRaw
        ? Number(headerNewIndexRaw)
        : null;

    const uploadedPhotoUrls: string[] = [];
    const photoFiles = formData.getAll("photos");

    for (const f of photoFiles) {
        if (!isNonEmptyFileLike(f)) {
            continue;
        }

        const file = f as File;

        try {
            const result = await uploadBlogPhoto(token, file);
            const url = (result as any)?.url;
            if (url) uploadedPhotoUrls.push(url);
        } catch {
            throw new Error("Failed to upload one of the images");
        }
    }

    let photos = [...uploadedPhotoUrls];

    if (
        headerNewIndex !== null &&
        headerNewIndex >= 0 &&
        headerNewIndex < uploadedPhotoUrls.length
    ) {
        const cover = uploadedPhotoUrls[headerNewIndex];
        photos = [
            cover,
            ...uploadedPhotoUrls.filter((u, i) => i !== headerNewIndex),
        ];
    }

    const body: any = {
        title,
        summary: summary || null,
        content: content || null,
        tags,
        techStack,
        photos,
        projectSlugs,
        eventSlugs,
        authorSlugs,
    };

    if (publishedAtRaw) {
        const d = new Date(publishedAtRaw);
        if (!Number.isNaN(d.getTime())) {
            body.publishedAt = d.toISOString();
        }
    }

    const res = await fetch(`${API_BASE}/api/blogs`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
    });

    if (!res.ok) {
        let msg = "Failed to create blog post";
        try {
            const json = await res.json();
            if (json?.error) msg = json.error;
        } catch {
            // ignore JSON parse errors
        }
        throw new Error(msg);
    }

    const json = await res.json();
    const slug = json?.slug || json?.blog?.slug;
    if (!slug) {
        throw new Error("Blog created but slug missing from response");
    }

    redirect(`/blog/${slug}`);
}

export default function NewBlogPage() {
    return (
        <section className="section max-w-3xl">
            <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="kicker">
                        {tServer("blog.new.kicker")}
                    </p>
                    <h1 className="display text-2xl sm:text-3xl">
                        {tServer("blog.new.title")}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-white/70">
                        {tServer("blog.new.subtitle")}
                    </p>
                </div>
                <Link
                    href="/blog"
                    className="text-sm text-white/70 underline underline-offset-4 hover:text-white"
                >
                    {tServer("blog.new.cancel")}
                </Link>
            </header>

            <BlogEditorForm mode="create" onSubmit={createBlog} />
        </section>
    );
}
