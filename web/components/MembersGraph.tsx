"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { tClient } from "@/lib/i18n-client";
import Avatar from "@/components/Avatar";

type Member = {
    id: string;
    slug: string;
    name: string;
    skills?: string[];
    avatarUrl?: string;

    /** extra fields that callers may pass (not currently used in the graph) */
    techStack?: string[];
    avatar?: string;
    imageUrl?: string;
    photoUrl?: string;
};

type Project = {
    id: string;
    slug: string;
    title: string;
    members?: { memberId?: string; memberSlug?: string }[];
    imageUrl?: string;

    /** extra fields that callers may pass (not currently used in the graph) */
    techStack?: string[];
    tags?: string[];
};

type Node = {
    id: string;
    type: "member" | "project";
    label: string;
    slug: string;
    color: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    imageUrl?: string;
};

type LinkEdge = {
    source: string;
    target: string;
    strength: number;
};

const SKILL_COLORS: Record<string, string> = {
    frontend: "#22d3ee",
    backend: "#a78bfa",
    fullstack: "#34d399",
    ml: "#f59e0b",
    ai: "#f59e0b",
    business: "#f472b6",
    management: "#9ca3af",
};

function pickSkillColor(skills?: string[]): string {
    if (!skills || skills.length === 0) return "#60a5fa";
    for (const s of skills) {
        const key = s.toLowerCase();
        if (SKILL_COLORS[key]) return SKILL_COLORS[key];
    }
    return "#60a5fa";
}

function useSize(el: React.RefObject<HTMLElement>) {
    const [size, setSize] = useState({ w: 800, h: 500 });
    useEffect(() => {
        const on = () => {
            if (!el.current) return;
            const rect = el.current.getBoundingClientRect();
            setSize({
                w: Math.max(320, rect.width),
                h: Math.max(320, rect.height),
            });
        };
        on();
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
    }, [el]);
    return size;
}

function hexToRgba(hex: string, alpha = 1) {
    let r = 0,
        g = 0,
        b = 0;
    const clean = hex.replace("#", "");
    if (clean.length === 3) {
        r = parseInt(clean[0] + clean[0], 16);
        g = parseInt(clean[1] + clean[1], 16);
        b = parseInt(clean[2] + clean[2], 16);
    } else if (clean.length >= 6) {
        r = parseInt(clean.slice(0, 2), 16);
        g = parseInt(clean.slice(2, 4), 16);
        b = parseInt(clean.slice(4, 6), 16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
}

// client-side highlighter
function highlight(text: string, q: string) {
    if (!q) return <>{text}</>;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${esc})`, "ig");
    const parts = text.split(re);
    return (
        <>
            {parts.map((p, i) =>
                re.test(p) ? (
                    <mark
                        key={i}
                        className="px-0.5 rounded bg-yellow-300/30 text-yellow-200"
                    >
                        {p}
                    </mark>
                ) : (
                    <span key={i}>{p}</span>
                ),
            )}
        </>
    );
}

export default function MembersGraph({
                                         members,
                                         projects,
                                         query = "",
                                     }: {
    members: Member[];
    projects: Project[];
    query?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { w, h } = useSize(containerRef);

    // Pointer state
    const [hoverId, setHoverId] = useState<string | null>(null);
    const [hoverLock, setHoverLock] = useState(false);
    const draggingIdRef = useRef<string | null>(null);
    const mouseRef = useRef({ x: 0, y: 0 });

    const { nodes, links, nodeById } = useMemo(() => {
        const nodes: Node[] = [];
        const links: LinkEdge[] = [];
        const nodeById = new Map<string, Node>();

        // Projects
        for (const p of projects) {
            const n: Node = {
                id: `p:${p.slug}`,
                type: "project",
                label: p.title,
                slug: p.slug,
                color: "#ffffff",
                x: (Math.random() * 2 - 1) * 200,
                y: (Math.random() * 2 - 1) * 200,
                vx: 0,
                vy: 0,
                radius: 6,
                imageUrl: p.imageUrl,
            };
            nodeById.set(n.id, n);
            nodes.push(n);
        }

        // Members
        for (const m of members) {
            const n: Node = {
                id: `m:${m.slug}`,
                type: "member",
                label: m.name,
                slug: m.slug,
                color: pickSkillColor(m.skills),
                x: (Math.random() * 2 - 1) * 240,
                y: (Math.random() * 2 - 1) * 240,
                vx: 0,
                vy: 0,
                radius: 10,
                imageUrl: m.avatarUrl,
            };
            nodeById.set(n.id, n);
            nodes.push(n);
        }

        // Edges
        for (const p of projects) {
            const pNodeId = `p:${p.slug}`;
            for (const r of p.members || []) {
                const memberSlug =
                    r.memberSlug || members.find((mm) => mm.id === r.memberId)?.slug;
                if (!memberSlug) continue;
                const mNodeId = `m:${memberSlug}`;
                if (nodeById.has(mNodeId) && nodeById.has(pNodeId)) {
                    links.push({
                        source: mNodeId,
                        target: pNodeId,
                        strength: 0.08,
                    });
                }
            }
        }

        return { nodes, links, nodeById };
    }, [members, projects]);

    // Force simulation + rendering
    useEffect(() => {
        let raf = 0;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const center = { x: w / 2, y: h / 2 };

        function step() {
            const repulsion = 2000;
            const springK = 0.07;
            const springLen = 80;
            const damping = 0.85;
            const centerPull = 0.02;

            // Repulsion
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j];
                    let dx = a.x - b.x;
                    let dy = a.y - b.y;
                    const dist2 = dx * dx + dy * dy + 0.01;
                    const f = repulsion / dist2;
                    const invDist = 1 / Math.sqrt(dist2);
                    dx *= invDist;
                    dy *= invDist;
                    if (draggingIdRef.current !== a.id) {
                        a.vx += dx * f;
                        a.vy += dy * f;
                    }
                    if (draggingIdRef.current !== b.id) {
                        b.vx -= dx * f;
                        b.vy -= dy * f;
                    }
                }
            }

            // Springs
            for (const e of links) {
                const a = nodeById.get(e.source)!;
                const b = nodeById.get(e.target)!;
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
                const force = (dist - springLen) * (springK * e.strength);
                dx /= dist;
                dy /= dist;
                if (draggingIdRef.current !== a.id) {
                    a.vx += dx * force;
                    a.vy += dy * force;
                }
                if (draggingIdRef.current !== b.id) {
                    b.vx -= dx * force;
                    b.vy -= dy * force;
                }
            }

            // Integrate + center pull + damping + bounds
            for (const n of nodes) {
                if (draggingIdRef.current === n.id) {
                    n.x = mouseRef.current.x;
                    n.y = mouseRef.current.y;
                    n.vx = 0;
                    n.vy = 0;
                    continue;
                }
                n.vx += (center.x - n.x) * centerPull;
                n.vy += (center.y - n.y) * centerPull;
                n.x += n.vx * 0.016;
                n.y += n.vy * 0.016;
                n.vx *= damping;
                n.vy *= damping;
                n.x = Math.max(16, Math.min(w - 16, n.x));
                n.y = Math.max(16, Math.min(h - 16, n.y));
            }

            ctx.clearRect(0, 0, w, h);

            // Hover glow
            if (hoverId) {
                const n = nodeById.get(hoverId);
                if (n) {
                    const grad = ctx.createRadialGradient(
                        n.x,
                        n.y,
                        0,
                        n.x,
                        n.y,
                        160,
                    );
                    grad.addColorStop(0, hexToRgba(n.color, 0.25));
                    grad.addColorStop(1, "rgba(0,0,0,0)");
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, 160, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Links
            ctx.lineWidth = 1;
            for (const e of links) {
                const a = nodeById.get(e.source)!;
                const b = nodeById.get(e.target)!;
                ctx.strokeStyle = "rgba(255,255,255,0.15)";
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }

            // Nodes
            for (const n of nodes) {
                ctx.beginPath();
                ctx.fillStyle = hexToRgba(n.color, 0.22);
                ctx.arc(n.x, n.y, n.radius * 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.beginPath();
                ctx.fillStyle = n.color;
                ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
                ctx.fill();
            }

            raf = requestAnimationFrame(step);
        }
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [w, h, nodes, links, nodeById, hoverId]);

    const hitNode = useCallback(
        (x: number, y: number): string | null => {
            let hit: string | null = null;
            let best = Infinity;
            for (const n of nodes) {
                const dx = n.x - x;
                const dy = n.y - y;
                const d2 = dx * dx + dy * dy;
                const thresh = (n.radius * 2.5) ** 2;
                if (d2 < thresh && d2 < best) {
                    best = d2;
                    hit = n.id;
                }
            }
            return hit;
        },
        [nodes],
    );

    useEffect(() => {
        const containerEl = containerRef.current;
        if (!containerEl) return;

        function getPos(evt: MouseEvent) {
            const canvasEl = canvasRef.current;
            if (!canvasEl) return null;

            const rect = canvasEl.getBoundingClientRect();
            const x = evt.clientX - rect.left;
            const y = evt.clientY - rect.top;
            mouseRef.current = { x, y };
            return { x, y };
        }

        function onMove(evt: MouseEvent) {
            const pos = getPos(evt);
            if (!pos) return;

            const { x, y } = pos;
            if (draggingIdRef.current) return;
            if (hoverLock) return;
            setHoverId(hitNode(x, y));
        }

        function onDown(evt: MouseEvent) {
            const pos = getPos(evt);
            if (!pos) return;

            const { x, y } = pos;
            const hit = hitNode(x, y);
            if (hit) {
                draggingIdRef.current = hit;
                setHoverId(hit);
            }
        }

        function onUp() {
            draggingIdRef.current = null;
        }

        function onLeave() {
            if (!hoverLock) setHoverId(null);
            draggingIdRef.current = null;
        }

        containerEl.addEventListener("mousemove", onMove);
        containerEl.addEventListener("mousedown", onDown);
        window.addEventListener("mouseup", onUp);
        containerEl.addEventListener("mouseleave", onLeave);

        function onTouchMove(evt: TouchEvent) {
            const t = evt.touches[0];
            if (!t) return;

            const canvasEl = canvasRef.current;
            if (!canvasEl) return;

            const rect = canvasEl.getBoundingClientRect();
            const x = t.clientX - rect.left;
            const y = t.clientY - rect.top;
            mouseRef.current = { x, y };

            if (draggingIdRef.current) return;
            if (hoverLock) return;
            setHoverId(hitNode(x, y));
        }

        function onTouchStart(evt: TouchEvent) {
            const t = evt.touches[0];
            if (!t) return;

            const canvasEl = canvasRef.current;
            if (!canvasEl) return;

            const rect = canvasEl.getBoundingClientRect();
            const x = t.clientX - rect.left;
            const y = t.clientY - rect.top;
            const hit = hitNode(x, y);
            if (hit) {
                draggingIdRef.current = hit;
                setHoverId(hit);
            }
        }

        function onTouchEnd() {
            draggingIdRef.current = null;
        }

        containerEl.addEventListener("touchmove", onTouchMove, { passive: true });
        containerEl.addEventListener("touchstart", onTouchStart, { passive: true });
        containerEl.addEventListener("touchend", onTouchEnd);

        return () => {
            containerEl.removeEventListener("mousemove", onMove);
            containerEl.removeEventListener("mousedown", onDown);
            window.removeEventListener("mouseup", onUp);
            containerEl.removeEventListener("mouseleave", onLeave);
            containerEl.removeEventListener("touchmove", onTouchMove);
            containerEl.removeEventListener("touchstart", onTouchStart);
            containerEl.removeEventListener("touchend", onTouchEnd);
        };
    }, [hoverLock, hitNode]);


    const hoverNode = hoverId ? nodeById.get(hoverId) : null;

    return (
        <div
            ref={containerRef}
            className="relative h-[560px] w-full rounded-2xl bg-black/50 ring-1 ring-white/10 overflow-hidden"
            aria-label={tClient("members.graph.ariaLabel")}
        >
            <canvas ref={canvasRef} className="absolute inset-0" />

            {/* Legend */}
            <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
                {Object.entries(SKILL_COLORS).map(([k, c]) => (
                    <span
                        key={k}
                        className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full ring-1 ring-white/10 bg-white/5"
                    >
                        <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: c }}
                        />
                        {tClient(`members.graph.legend.${k}`)}
                    </span>
                ))}
            </div>

            {/* Tooltip */}
            {hoverNode && (
                <div
                    className="absolute z-20 -translate-y-8 translate-x-4"
                    style={{ left: hoverNode.x, top: hoverNode.y }}
                    onMouseEnter={() => setHoverLock(true)}
                    onMouseLeave={() => setHoverLock(false)}
                >
                    <div className="rounded-xl px-3 py-2 text-sm bg-black/80 ring-1 ring-white/20 backdrop-blur pointer-events-auto max-w-xs">
                        <div className="flex items-center gap-2">
                            <Avatar name={hoverNode.label} src={hoverNode.imageUrl} size={40} className="ring-1 ring-white/10" />
                            <div className="min-w-0">
                                <div className="font-semibold truncate">
                                    {highlight(hoverNode.label, query)}
                                </div>
                                <div className="text-xs text-white/60">
                                    {hoverNode.type === "member"
                                        ? tClient("members.graph.type.member")
                                        : tClient("members.graph.type.project")}
                                </div>
                            </div>
                        </div>
                        <div className="mt-2">
                            <Link
                                href={
                                    hoverNode.type === "member"
                                        ? `/members/${hoverNode.slug}`
                                        : `/projects/${hoverNode.slug}`
                                }
                                className="text-xs underline underline-offset-4"
                            >
                                {tClient("members.graph.openPage")}
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}