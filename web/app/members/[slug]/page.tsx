/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { API_BASE } from "@/lib/config";
import type { Metadata } from "next";

// Always fetch fresh data (no build-time seeds)
export const dynamic = "force-dynamic";

type MemberDetail = {
    id: string;
    slug: string;
    name: string;
    avatar?: string | null;
    avatarUrl?: string | null;
    headline?: string | null;
    shortBio?: string | null;
    bio?: string | null;
    location?: string | null;
    links?: Record<string, string> | null;
    photos?: string[] | null;
    skills?: string[];
    techStack?: string[];
    projects?: {
        id: string;
        slug: string;
        title: string;
        role?: string | null;
        contribution?: string | null;
        cover?: string | null;
        year?: number | null;
    }[];
    events?: {
        id: string;
        slug: string;
        name: string;
        role?: string | null;
    }[];
};

async function getMember(slug: string): Promise<MemberDetail | null> {
    const res = await fetch(`${API_BASE}/api/members/${slug}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to load member");
    return res.json();
}

export async function generateMetadata({
                                           params,
                                       }: {
    params: { slug: string };
}): Promise<Metadata> {
    const member = await getMember(params.slug);
    return {
        title: member ? `${member.name} – Member` : "Member",
        description: member?.headline || member?.bio || member?.shortBio || "Member profile",
    };
}

export default async function MemberPage({
                                             params,
                                         }: {
    params: { slug: string };
}) {
    const member = await getMember(params.slug);

    if (!member) {
        return (
            <section className="container mx-auto px-4 py-12">
                <h1 className="mb-2 text-3xl font-semibold">Member not found</h1>
                <p className="text-white/70">
                    We couldn’t find that profile.{" "}
                    <Link href="/members" className="underline">
                        Back to Members
                    </Link>
                </p>
            </section>
        );
    }

    const avatar = member.avatar || member.avatarUrl || "/avatars/default.png";

    return (
        <section className="container mx-auto px-4 py-8">
            <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center">
                <img
                    src={avatar}
                    alt={member.name}
                    className="h-28 w-28 rounded-full object-cover ring-2 ring-white/10"
                />
                <div className="min-w-0">
                    <h1 className="text-3xl font-semibold tracking-tight">{member.name}</h1>
                    {member.headline && (
                        <p className="mt-1 text-white/70">{member.headline}</p>
                    )}
                    {member.location && (
                        <p className="mt-1 text-sm text-white/60">{member.location}</p>
                    )}

                    {/* Links (render as inline list) */}
                    {member.links && Object.keys(member.links).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-3 text-sm">
                            {Object.entries(member.links).map(([label, href]) =>
                                href ? (
                                    <a
                                        key={label}
                                        href={href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full border border-white/10 px-3 py-1 text-white/80 hover:border-white/20"
                                    >
                                        {label}
                                    </a>
                                ) : null
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
                {/* Main */}
                <div className="space-y-6 lg:col-span-3">
                    {(member.bio || member.shortBio) && (
                        <div className="rounded-2xl border border-white/10 p-5">
                            <h2 className="mb-2 text-lg font-semibold">About</h2>
                            <p className="whitespace-pre-line text-white/80">
                                {member.bio || member.shortBio}
                            </p>
                        </div>
                    )}

                    {!!(member.projects?.length || 0) && (
                        <div className="rounded-2xl border border-white/10 p-5">
                            <h2 className="mb-4 text-lg font-semibold">Projects</h2>
                            <ul className="space-y-3">
                                {member.projects!.map((p) => (
                                    <li key={p.slug} className="flex items-center gap-4">
                                        <img
                                            src={p.cover || "/placeholders/project.png"}
                                            alt=""
                                            className="h-12 w-12 rounded object-cover ring-1 ring-white/10"
                                        />
                                        <div className="min-w-0">
                                            <Link
                                                href={`/projects/${p.slug}`}
                                                className="font-medium hover:underline"
                                            >
                                                {p.title}
                                            </Link>
                                            <div className="text-sm text-white/60">
                                                {[
                                                    p.role ? `Role: ${p.role}` : null,
                                                    p.year ? `Year: ${p.year}` : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" • ")}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!!(member.events?.length || 0) && (
                        <div className="rounded-2xl border border-white/10 p-5">
                            <h2 className="mb-4 text-lg font-semibold">Events</h2>
                            <ul className="space-y-2">
                                {member.events!.map((ev) => (
                                    <li key={ev.slug}>
                                        <Link
                                            href={`/events/${ev.slug}`}
                                            className="hover:underline"
                                        >
                                            {ev.name}
                                        </Link>
                                        {ev.role ? (
                                            <span className="ml-2 text-sm text-white/60">
                        ({ev.role})
                      </span>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <aside className="space-y-6 lg:col-span-2">
                    {!!(member.skills?.length || 0) && (
                        <div className="rounded-2xl border border-white/10 p-5">
                            <h3 className="mb-3 text-base font-semibold">Skills</h3>
                            <div className="flex flex-wrap gap-2">
                                {member.skills!.map((s) => (
                                    <Link
                                        key={s}
                                        href={`/members?skill=${encodeURIComponent(s)}`}
                                        className="rounded-full border border-white/10 px-3 py-1 text-sm hover:border-white/20"
                                    >
                                        {s}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {!!(member.techStack?.length || 0) && (
                        <div className="rounded-2xl border border-white/10 p-5">
                            <h3 className="mb-3 text-base font-semibold">Tech</h3>
                            <div className="flex flex-wrap gap-2">
                                {member.techStack!.map((t) => (
                                    <Link
                                        key={t}
                                        href={`/members?tech=${encodeURIComponent(t)}`}
                                        className="rounded-full border border-white/10 px-3 py-1 text-sm hover:border-white/20"
                                    >
                                        {t}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {!!(member.photos?.length || 0) && (
                        <div className="rounded-2xl border border-white/10 p-5">
                            <h3 className="mb-3 text-base font-semibold">Photos</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {member.photos!.map((src, i) => (
                                    <img
                                        key={`${src}-${i}`}
                                        src={src}
                                        alt=""
                                        className="h-24 w-full rounded object-cover ring-1 ring-white/10"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </section>
    );
}
