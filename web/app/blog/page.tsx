// web/app/blog/page.tsx
import React from "react";
import Link from "next/link";
import MembersSearchBar from "@/components/MembersSearchBar";
import NewBlogButton from "@/components/NewBlogButton";
import { API_BASE } from "@/lib/config";
import { tServer } from "@/lib/i18n-server";
import {
    uniq,
    parseMulti,
    includesAll,
    checkMatches,
    highlight,
} from "@/lib/list-utils";
import MultiFilterChips from "@/components/MultiFilterChips";
import PageCtaCard from "@/components/PageCtaCard";

type BlogAuthorCard = {
    slug: string;
    name: string;
    avatarUrl?: string | null;
    headline?: string | null;
    role?: string | null;
};

type BlogCard = {
    id?: string;
    slug: string;
    title: string;
    summary?: string;
    cover?: string | null;
    imageUrl?: string | null;
    publishedAt?: string | null;
    tags?: string[];
    techStack?: string[];
    authors?: BlogAuthorCard[];
};

type RawBlogListItem = {
    id?: string;
    slug?: string;
    title?: string;
    summary?: string;
    cover?: string | null;
    imageUrl?: string | null;
    publishedAt?: string | null;
    tags?: string[];
    techStack?: string[];
    authors?: {
        slug?: string;
        name?: string;
        avatarUrl?: string | null;
        headline?: string | null;
        role?: string | null;
    }[];
};

type BlogListResponse = RawBlogListItem[] | { items?: RawBlogListItem[] };

function matchesQuery(b: BlogCard, q: string): boolean {
    return checkMatches(q, [
        b.title || "",
        b.summary || "",
        ...(b.tags || []),
        ...(b.techStack || []),
    ]);
}

async function fetchApiBlogs(): Promise<BlogCard[]> {
    const url = `${API_BASE}/api/blogs?size=999`;

    try {

        const res = await fetch(url, {
            cache: "no-store",
        });
        if (!res.ok) {
            return [];
        }

        const json = (await res.json()) as BlogListResponse;
        const items: RawBlogListItem[] = Array.isArray(json) ? json : json.items ?? [];

        const result = items.map(
            (b): BlogCard => ({
                id: b.id,
                slug: b.slug ?? "",
                title: b.title ?? "",
                summary: b.summary,
                cover: b.cover ?? b.imageUrl ?? null,
                imageUrl: b.imageUrl ?? null,
                publishedAt: b.publishedAt ?? null,
                tags: b.tags ?? [],
                techStack: b.techStack ?? [],
                authors:
                    b.authors?.map((a) => ({
                        slug: a.slug ?? "",
                        name: a.name ?? "",
                        avatarUrl: a.avatarUrl ?? null,
                        headline: a.headline ?? null,
                        role: a.role ?? null,
                    })) ?? [],
            }),
        );

        return result;
    } catch (err) {
        return [];
    }
}

export default async function BlogsPage({
                                            searchParams,
                                        }: {
    searchParams?: {
        q?: string;
        tag?: string;
        tech?: string;
        sort?: string;
    };
}) {
    const q = searchParams?.q || "";
    const tagsSel = parseMulti(searchParams?.tag);
    const techSel = parseMulti(searchParams?.tech);
    const sort = (searchParams?.sort || "newest") as "newest" | "az";

    const all = await fetchApiBlogs();

    const allTags = uniq(all.flatMap((b) => b.tags || [])).sort();
    const allTech = uniq(all.flatMap((b) => b.techStack || [])).sort();

    const filtered = all
        .filter((b) => matchesQuery(b, q))
        .filter((b) => includesAll(b.tags, tagsSel))
        .filter((b) => includesAll(b.techStack, techSel))
        .sort((a, b) => {
            if (sort === "az") return (a.title || "").localeCompare(b.title || "");
            const ad = a.publishedAt ? +new Date(a.publishedAt) : 0;
            const bd = b.publishedAt ? +new Date(b.publishedAt) : 0;
            if (ad === bd) return (a.title || "").localeCompare(b.title || "");
            return bd - ad;
        });

    return (
        <section className="section">
            <PageCtaCard
                kicker={tServer("blog.list.kicker")}
                title={tServer("blog.list.title")}
                description={tServer("blog.list.subtitle")}
                cta={<NewBlogButton />}
            />

            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex-1">
                    <MembersSearchBar
                        placeholder={tServer("blog.list.search.placeholder")}
                        paramKey="q"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {(["newest", "az"] as const).map((s) => {
                        const p = new URLSearchParams();
                        if (searchParams) {
                            Object.entries(searchParams).forEach(([key, value]) => {
                                if (value) {
                                    p.set(key, value);
                                }
                            });
                        }
                        p.set("sort", s);
                        const href = `/blog?${p.toString()}`;
                        const active = sort === s;
                        const label =
                            s === "az"
                                ? tServer("blog.list.sort.az")
                                : tServer("blog.list.sort.newest");
                        return (
                            <Link
                                key={s}
                                href={href}
                                className={`rounded-lg px-3 py-2 text-sm ring-1 ring-white/10 ${
                                    active
                                        ? "bg-white text-black font-semibold"
                                        : "bg-white/5 hover:bg.white/10"
                                }`}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="mb-8 grid gap-3 md:grid-cols-2">
                <div className="card p-3">
                    <div className="mb-2 text-xs uppercase tracking-widest text-white/60">
                        {tServer("blog.list.filters.tagsLabel")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips
                            base="/blog"
                            params={{
                                q,
                                tech: techSel.join(","),
                                sort,
                            }}
                            values={allTags}
                            selected={tagsSel}
                            name="tag"
                            clearLabel={tServer("blog.list.filters.clear")}
                        />
                    </div>
                </div>
                <div className="card p-3">
                    <div className="mb-2 text-xs uppercase tracking-widest text-white/60">
                        {tServer("blog.list.filters.techLabel")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips
                            base="/blog"
                            params={{
                                q,
                                tag: tagsSel.join(","),
                                sort,
                            }}
                            values={allTech}
                            selected={techSel}
                            name="tech"
                            clearLabel={tServer("blog.list.filters.clear")}
                        />
                    </div>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((b) => (
                    <Link
                        key={b.slug}
                        href={`/blog/${b.slug}`}
                        className="card transition p-4 hover:bg-white/10"
                    >
                        {b.cover && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={b.cover}
                                alt={b.title}
                                className="mb-3 h-40 w-full rounded-md object-cover ring-1 ring-white/10"
                                loading="lazy"
                            />
                        )}
                        <div className="flex flex-wrap items-center gap-1 text-xs text-white/60">
                            {b.publishedAt
                                ? new Date(b.publishedAt).toLocaleDateString()
                                : ""}
                            {b.authors && b.authors.length > 0 && (
                                <>
                                    <span>•</span>
                                    <span className="truncate">
                                        {b.authors
                                            .map((a) => a.name)
                                            .filter(Boolean)
                                            .join(", ")}
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-lg font-semibold">
                            {highlight(b.title, q)}
                        </div>
                        {b.summary && (
                            <div className="mt-2 line-clamp-3 text-sm text-white/70">
                                {highlight(b.summary, q)}
                            </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {(b.tags || [])
                                .slice(0, 6)
                                .map((t) => (
                                    <span
                                        key={t}
                                        className="rounded-full bg-white/5 px-2 py-1 text-[11px] ring-1 ring-white/10"
                                    >
                                        {highlight(t, q)}
                                    </span>
                                ))}
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-10">
                <div className="card flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">
                            {tServer("blog.list.cta.title")}
                        </h2>
                        <p className="mt-1 max-w-xl text-sm text-white/70">
                            {tServer("blog.list.cta.body")}
                        </p>
                    </div>
                    <Link
                        href="/contact"
                        className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                    >
                        {tServer("blog.list.cta.button")}
                        <span aria-hidden className="ml-1">
                            →
                        </span>
                    </Link>
                </div>
            </div>
        </section>
    );
}