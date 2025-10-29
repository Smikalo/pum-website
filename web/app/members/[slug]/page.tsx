// web/app/members/[slug]/page.tsx
import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { API_BASE } from "@/lib/config";

/* ----------------------------- Types ----------------------------- */
type Member = {
    id: string;
    slug: string;
    name: string;
    avatarUrl?: string;
    headline?: string;
    shortBio?: string;
    longBio?: string;
    skills?: string[];
    techStack?: string[];
    links?: Record<string, string>;
    projects?: { slug: string; title?: string; role?: string }[];
};

/* --------------------------- Fetch helpers --------------------------- */
async function fetchMember(slug: string): Promise<Member | null> {
    const candidates = [
        `/api/members/${encodeURIComponent(slug)}`,
        `/api/people/${encodeURIComponent(slug)}`,
    ];
    for (const path of candidates) {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (res.ok) {
                const json = await res.json();
                return normalizeMember(json);
            }
        } catch {
            // try next
        }
    }
    return null;
}

async function fetchMemberSlugs(): Promise<string[]> {
    const candidates = ["/api/members?size=999", "/api/members", "/api/people"];
    for (const path of candidates) {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (!res.ok) continue;
            const json = await res.json();
            const items: any[] = Array.isArray(json) ? json : json.items ?? [];
            return items
                .map((m: any) => String(m.slug ?? m.id ?? ""))
                .filter(Boolean);
        } catch {
            // next
        }
    }
    return [];
}

function normalizeMember(m: any): Member {
    const slug: string = m.slug ?? m.id ?? "";
    const projects = (m.projects || m.contributions || []).map((p: any) => ({
        slug: p.slug ?? p.projectSlug ?? p.projectId ?? "",
        title: p.title ?? p.name ?? undefined,
        role: p.role ?? undefined,
    }));
    return {
        id: String(m.id ?? slug),
        slug,
        name: m.name ?? slug,
        avatarUrl: m.avatarUrl ?? m.avatar ?? undefined,
        headline: m.headline ?? undefined,
        shortBio: m.shortBio ?? undefined,
        longBio: m.longBio ?? m.bio ?? undefined,
        skills: m.skills ?? m.tags ?? [],
        techStack: m.techStack ?? m.stack ?? [],
        links: m.links ?? {},
        projects,
    };
}

/* -------------------------- Next.js wiring -------------------------- */
export async function generateStaticParams() {
    const slugs = await fetchMemberSlugs();
    return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
                                           params,
                                       }: {
    params: { slug: string };
}): Promise<Metadata> {
    const m = await fetchMember(params.slug);
    const title = m ? `${m.name} – Member` : "Member";
    const description = m?.shortBio || m?.headline || "PUM Member";
    return { title, description };
}

/* -------------------------------- Page -------------------------------- */
export default async function MemberDetail({
                                               params,
                                           }: {
    params: { slug: string };
}) {
    const m = await fetchMember(params.slug);
    if (!m) {
        return (
            <section className="section">
                <h1 className="h1">Member not found</h1>
                <Link href="/members" className="underline underline-offset-4">← Back to all members</Link>
            </section>
        );
    }

    return (
        <section className="section">
            <h1 className="h1">{m.name}</h1>
            {m.headline && <p className="text-white/70">{m.headline}</p>}

            <div className="mt-6 grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    {m.longBio && <p className="text-white/80 whitespace-pre-line">{m.longBio}</p>}

                    {!!(m.projects?.length) && (
                        <div>
                            <h2 className="h3">Projects</h2>
                            <ul className="mt-2 grid sm:grid-cols-2 gap-2">
                                {m.projects!.map((p) => (
                                    <li key={p.slug} className="row-card">
                                        <Link href={`/projects/${p.slug}`} className="font-medium underline underline-offset-4">
                                            {p.title || p.slug}
                                        </Link>
                                        {p.role && <div className="text-xs text-white/60 mt-1">{p.role}</div>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <aside className="space-y-4">
                    {/* Avatar */}
                    <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-white/5 p-3">
                        <Avatar name={m.name} src={m.avatarUrl} size={120} />
                    </div>

                    {/* Tags */}
                    {!!(m.skills?.length || m.techStack?.length) && (
                        <div className="rounded-xl ring-1 ring-white/10 bg-white/5 p-3">
                            <div className="text-xs text-white/60 mb-2">Tags</div>
                            <div className="flex flex-wrap gap-2">
                                {[...(m.skills || []), ...(m.techStack || [])].map((t) => (
                                    <span key={t} className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{t}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            <div className="mt-8">
                <Link href="/members" className="underline underline-offset-4">← Back to all members</Link>
            </div>
        </section>
    );
}

function Avatar({ name, src, size = 120 }: { name: string; src?: string; size?: number }) {
    const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
    return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={name}
            width={size}
            height={size}
            className="rounded-md object-cover ring-1 ring-white/10"
        />
    ) : (
        <div
            className="rounded-md grid place-items-center bg-white/10 ring-1 ring-white/10 text-white/80"
            style={{ width: size, height: size }}
            aria-hidden
        >
            <span className="text-xl">{initials}</span>
        </div>
    );
}
