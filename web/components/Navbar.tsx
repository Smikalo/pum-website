"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/members", label: "Members" },
    { href: "/projects", label: "Projects" },
    { href: "/events", label: "Events" },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
];

export default function Navbar() {
    const pathname = usePathname();
    const [open, setOpen] = React.useState(false);
    const firstLinkRef = React.useRef<HTMLAnchorElement | null>(null);

    // Close the mobile menu on route change
    React.useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Close on Escape
    React.useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    // Focus first link when opening (accessibility)
    React.useEffect(() => {
        if (open) firstLinkRef.current?.focus();
    }, [open]);

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + "/");

    return (
        <header className="sticky top-0 z-40 backdrop-blur bg-black/40 ring-1 ring-white/10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Brand */}
                <div className="flex items-center gap-3">
                    <Link href="/" className="font-extrabold tracking-tight text-white text-lg">
                        PUM
                    </Link>
                    <span className="hidden sm:inline text-white/40 text-sm">Project of United Minds</span>
                </div>

                {/* Desktop nav */}
                <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={[
                                "px-3 py-2 rounded-lg text-sm transition ring-1 ring-white/10",
                                isActive(item.href)
                                    ? "bg-white text-black font-semibold"
                                    : "text-white/80 hover:bg-white/10"
                            ].join(" ")}
                            aria-current={isActive(item.href) ? "page" : undefined}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {/* Mobile toggle */}
                <button
                    type="button"
                    className="md:hidden inline-flex items-center justify-center rounded-lg px-3 py-2 ring-1 ring-white/10 text-white/90 hover:bg-white/10"
                    aria-controls="mobile-nav"
                    aria-expanded={open}
                    aria-label="Open navigation"
                    onClick={() => setOpen((v) => !v)}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        {open ? (
                            <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        ) : (
                            <path d="M3 6H21M3 12H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        )}
                    </svg>
                </button>
            </div>

            {/* Mobile overlay + drawer */}
            <div
                className={[
                    "md:hidden fixed inset-0 z-50 transition",
                    open ? "pointer-events-auto" : "pointer-events-none"
                ].join(" ")}
            >
                {/* Clickable overlay */}
                <div
                    className={[
                        "absolute inset-0 bg-black/60 transition-opacity",
                        open ? "opacity-100" : "opacity-0"
                    ].join(" ")}
                    onClick={() => setOpen(false)}
                    aria-hidden
                />

                {/* Drawer panel */}
                <div
                    id="mobile-nav"
                    role="dialog"
                    aria-modal="true"
                    className={[
                        "absolute top-0 right-0 h-full w-80 max-w-[85%] bg-neutral-950 ring-1 ring-white/10",
                        "transition-transform duration-200 ease-out",
                        open ? "translate-x-0" : "translate-x-full"
                    ].join(" ")}
                >
                    <div className="h-16 px-4 flex items-center justify-between">
                        <span className="font-semibold">Menu</span>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-lg px-2 py-2 ring-1 ring-white/10 text-white/90 hover:bg-white/10"
                            aria-label="Close navigation"
                            onClick={() => setOpen(false)}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                        </button>
                    </div>

                    <nav aria-label="Mobile Primary" className="px-2 pb-6 space-y-1">
                        {NAV_ITEMS.map((item, idx) => {
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    ref={idx === 0 ? firstLinkRef : undefined}
                                    className={[
                                        "block px-3 py-2 rounded-lg text-base ring-1 ring-white/10",
                                        active ? "bg-white text-black font-semibold" : "text-white/90 hover:bg-white/10"
                                    ].join(" ")}
                                    aria-current={active ? "page" : undefined}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </header>
    );
}
