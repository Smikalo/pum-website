"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Member = {
    id: string;
    slug: string;
    name: string;
    skills?: string[];
};

type Project = {
    id: string;
    slug: string;
    title: string;
    members?: { memberId?: string; memberSlug?: string }[];
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
};

type LinkEdge = {
    source: string;
    target: string;
    strength: number;
};

const SKILL_COLORS: Record<string, string> = {
    frontend: "#22d3ee",  // cyan-400
    backend: "#a78bfa",   // violet-400
    fullstack: "#34d399", // emerald-400
    "ml": "#f59e0b",      // amber-500
    "ai": "#f59e0b",      // amber-500
    business: "#f472b6",  // pink-400
    management: "#9ca3af" // gray-400
};

function pickSkillColor(skills?: string[]): string {
    if (!skills || skills.length === 0) return "#60a5fa"; // blue-400 default
    for (const s of skills) {
        const key = s.toLowerCase();
        if (SKILL_COLORS[key]) return SKILL_COLORS[key];
    }
    return "#60a5fa";
}

function useSize(el: React.RefObject<HTMLElement>) {
    const [size, setSize] = useState({w: 800, h: 500});
    useEffect(()=>{
        const on = () => {
            if (!el.current) return;
            const rect = el.current.getBoundingClientRect();
            setSize({w: Math.max(320, rect.width), h: Math.max(320, rect.height)});
        };
        on();
        window.addEventListener("resize", on);
        return ()=>window.removeEventListener("resize", on);
    }, [el]);
    return size;
}

export default function MembersGraph({
                                         members,
                                         projects,
                                     }: {
    members: Member[];
    projects: Project[];
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { w, h } = useSize(containerRef);

    const [hoverId, setHoverId] = useState<string|null>(null);

    // Build nodes+links for a bipartite graph (members <-> projects)
    const { nodes, links, nodeById } = useMemo(()=>{
        const nodes: Node[] = [];
        const links: LinkEdge[] = [];
        const nodeById = new Map<string, Node>();

        // Projects (smaller, neutral color)
        for (const p of projects) {
            const n: Node = {
                id: `p:${p.slug}`,
                type: "project",
                label: p.title,
                slug: p.slug,
                color: "#ffffff",
                x: (Math.random()*2 - 1) * 200,
                y: (Math.random()*2 - 1) * 200,
                vx: 0, vy: 0,
                radius: 6
            };
            nodeById.set(n.id, n);
            nodes.push(n);
        }

        // Members (bigger, colored by skill)
        for (const m of members) {
            const n: Node = {
                id: `m:${m.slug}`,
                type: "member",
                label: m.name,
                slug: m.slug,
                color: pickSkillColor(m.skills),
                x: (Math.random()*2 - 1) * 240,
                y: (Math.random()*2 - 1) * 240,
                vx: 0, vy: 0,
                radius: 10
            };
            nodeById.set(n.id, n);
            nodes.push(n);
        }

        // Edges
        for (const p of projects) {
            const pNodeId = `p:${p.slug}`;
            for (const r of (p.members||[])) {
                const memberSlug = r.memberSlug || members.find(mm=>mm.id===r.memberId)?.slug;
                if (!memberSlug) continue;
                const mNodeId = `m:${memberSlug}`;
                if (nodeById.has(mNodeId) && nodeById.has(pNodeId)) {
                    links.push({ source: mNodeId, target: pNodeId, strength: 0.08 });
                }
            }
        }

        return { nodes, links, nodeById };
    }, [members, projects]);

    // Simple force simulation (Coulomb repulsion + spring edges + centering)
    useEffect(()=>{
        let raf = 0;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.scale(dpr, dpr);

        const center = { x: w/2, y: h/2 };

        function step() {
            // Physics params
            const repulsion = 2000; // higher -> more spacing
            const springK = 0.07;   // link strength
            const springLen = 80;   // preferred length
            const damping = 0.85;
            const centerPull = 0.02;

            // Repulsion
            for (let i=0;i<nodes.length;i++) {
                const a = nodes[i];
                for (let j=i+1;j<nodes.length;j++) {
                    const b = nodes[j];
                    let dx = (a.x - b.x);
                    let dy = (a.y - b.y);
                    let dist2 = dx*dx + dy*dy + 0.01;
                    let f = repulsion / dist2;
                    let invDist = 1/Math.sqrt(dist2);
                    dx *= invDist; dy *= invDist;
                    a.vx += dx * f; a.vy += dy * f;
                    b.vx -= dx * f; b.vy -= dy * f;
                }
            }

            // Springs
            for (const e of links) {
                const a = nodeById.get(e.source)!;
                const b = nodeById.get(e.target)!;
                let dx = (b.x - a.x);
                let dy = (b.y - a.y);
                const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
                const force = (dist - springLen) * (springK * e.strength);
                dx /= dist; dy /= dist;
                // apply
                a.vx += dx * force;
                a.vy += dy * force;
                b.vx -= dx * force;
                b.vy -= dy * force;
            }

            // Integrate + center pull + damping + bounds
            for (const n of nodes) {
                n.vx += (center.x - n.x) * centerPull;
                n.vy += (center.y - n.y) * centerPull;
                n.x += n.vx * 0.016; // dt
                n.y += n.vy * 0.016;
                n.vx *= damping;
                n.vy *= damping;
                // soft bounds
                n.x = Math.max(16, Math.min(w-16, n.x));
                n.y = Math.max(16, Math.min(h-16, n.y));
            }

            // Draw
            const cw = w, ch = h;
            ctx.clearRect(0,0,cw,ch);

            // Neon background glow for hovered node
            if (hoverId) {
                const n = nodeById.get(hoverId);
                if (n) {
                    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 160);
                    grad.addColorStop(0, `${hexToRgba(n.color, 0.25)}`);
                    grad.addColorStop(1, "rgba(0,0,0,0)");
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, 160, 0, Math.PI*2);
                    ctx.fill();
                }
            }

            // Edges
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
                // soft outer glow
                ctx.beginPath();
                ctx.fillStyle = hexToRgba(n.color, 0.22);
                ctx.arc(n.x, n.y, n.radius*3, 0, Math.PI*2);
                ctx.fill();

                // core
                ctx.beginPath();
                ctx.fillStyle = n.color;
                ctx.arc(n.x, n.y, n.radius, 0, Math.PI*2);
                ctx.fill();
            }

            raf = requestAnimationFrame(step);
        }
        raf = requestAnimationFrame(step);
        return ()=>cancelAnimationFrame(raf);
    }, [w, h, nodes, links, nodeById, hoverId]);

    // Hover + click detection
    useEffect(()=>{
        const canvas = canvasRef.current!;
        function getMousePos(evt: MouseEvent) {
            const rect = canvas.getBoundingClientRect();
            const x = (evt.clientX - rect.left);
            const y = (evt.clientY - rect.top);
            return {x,y};
        }

        function onMove(evt: MouseEvent) {
            const {x,y} = getMousePos(evt);
            // find closest node within radius*2.5
            let hit: string|null = null;
            let best = Infinity;
            for (const n of nodes) {
                const dx = n.x - x;
                const dy = n.y - y;
                const d2 = dx*dx + dy*dy;
                const thresh = (n.radius*2.5) ** 2;
                if (d2 < thresh && d2 < best) {
                    best = d2;
                    hit = n.id;
                }
            }
            setHoverId(hit);
        }
        function onLeave(){ setHoverId(null); }
        canvas.addEventListener("mousemove", onMove);
        canvas.addEventListener("mouseleave", onLeave);
        return ()=>{
            canvas.removeEventListener("mousemove", onMove);
            canvas.removeEventListener("mouseleave", onLeave);
        };
    }, [nodes]);

    const hoverNode = hoverId ? nodeById.get(hoverId) : null;

    return (
        <div ref={containerRef} className="relative h-[560px] w-full rounded-2xl bg-black/50 ring-1 ring-white/10 overflow-hidden">
            <canvas ref={canvasRef} className="absolute inset-0" />
            {/* Legend */}
            <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
                {Object.entries(SKILL_COLORS).map(([k,c])=>(
                    <span key={k} className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full ring-1 ring-white/10 bg-white/5">
            <span className="inline-block w-2 h-2 rounded-full" style={{backgroundColor:c}} />
                        {k.toUpperCase()}
          </span>
                ))}
            </div>

            {/* Tooltip */}
            {hoverNode && (
                <div
                    className="absolute z-20 -translate-y-8 translate-x-4"
                    style={{ left: hoverNode.x, top: hoverNode.y }}
                >
                    <div className="rounded-xl px-3 py-2 text-sm bg-black/80 ring-1 ring-white/20 backdrop-blur">
                        <div className="font-semibold">{hoverNode.label}</div>
                        <div className="text-xs text-white/60">{hoverNode.type === "member" ? "Member" : "Project"}</div>
                        <div className="mt-1">
                            <Link
                                href={hoverNode.type === "member" ? `/members/${hoverNode.slug}` : `/projects/${hoverNode.slug}`}
                                className="text-xs underline underline-offset-4"
                            >
                                Open page →
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// helpers
function hexToRgba(hex: string, alpha=1) {
    // supports #rgb or #rrggbb
    let r=0,g=0,b=0;
    const clean = hex.replace("#","");
    if (clean.length===3) {
        r = parseInt(clean[0]+clean[0],16);
        g = parseInt(clean[1]+clean[1],16);
        b = parseInt(clean[2]+clean[2],16);
    } else {
        r = parseInt(clean.slice(0,2),16);
        g = parseInt(clean.slice(2,4),16);
        b = parseInt(clean.slice(4,6),16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
}
