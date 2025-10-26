import React from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/config";
import { SEED_POSTS, type BlogPost } from "@/data/blog.seed";

export async function generateStaticParams() {
    // Provide some static params from seeds to avoid 404 on first load; API posts show up at runtime.
    return SEED_POSTS.map(p => ({ slug: p.slug }));
}

async function fetchApiPost(slug: string): Promise<BlogPost | null> {
    async function tryPath(path: string) {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (!res.ok) return null;
            const json = await res.json();
            if (Array.isArray(json?.items)) {
                return json.items.find((x: any) => x.slug === slug) ?? null;
            }
            if (Array.isArray(json)) {
                return json.find((x: any) => x.slug === slug) ?? null;
            }
            return json?.slug === slug ? json : null;
        } catch { return null; }
    }
    return (await tryPath(`/api/blog/${slug}`)) || (await tryPath(`/api/posts/${slug}`));
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
    const fromSeed = SEED_POSTS.find(p => p.slug === params.slug) || null;
    const fromApi = await fetchApiPost(params.slug);
    const post = fromApi || fromSeed;

    if (!post) {
        return (
            <section className="section">
                <h1 className="display">Post not found</h1>
                <p className="mt-4"><Link href="/blog" className="underline underline-offset-4">Back to blog</Link></p>
            </section>
        );
    }

    return (
        <section className="section">
            <div className="mb-6">
                <p className="kicker">BLOG</p>
                <h1 className="display">{post.title}</h1>
                <div className="mt-2 text-white/60 text-sm">{new Date(post.date).toLocaleDateString()}</div>
                {post.cover && (
                    <img src={post.cover} alt={post.title} className="w-full h-80 object-cover rounded-xl ring-1 ring-white/10 mt-4" />
                )}
            </div>

            <article className="prose prose-invert max-w-none">
                {/* keep content simple HTML; your API/MD renderer can replace this later */}
                <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
            </article>

            <div className="mt-8 flex flex-wrap gap-2">
                {(post.tags||[]).map(t => (
                    <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                        {t}
                    </Link>
                ))}
            </div>

            <div className="mt-8">
                <Link href="/blog" className="underline underline-offset-4">← Back to all posts</Link>
            </div>
        </section>
    );
}
