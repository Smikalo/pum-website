"use client";

import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import * as Dialog from "@radix-ui/react-dialog";
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

export default function NavBar() {
    const pathname = usePathname();
    const [open, setOpen] = React.useState(false);
    const firstLinkRef = React.useRef<HTMLAnchorElement | null>(null);

    React.useEffect(() => setOpen(false), [pathname]);
    React.useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        if (open) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);
    React.useEffect(() => {
        if (open) firstLinkRef.current?.focus();
    }, [open]);

    const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

    return (
        /* Full-width top bar, tiny bottom border only */
        <header className="sticky top-0 z-50 bg-black/60 backdrop-blur border-b border-white/10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Brand */}
                <div className="flex items-center gap-3">
                    <Link href="/" className="font-extrabold tracking-tight text-white text-lg">PUM</Link>
                    <span className="hidden sm:inline text-white/40 text-sm">Project of United Minds</span>
                </div>

                {/* Desktop nav — Radix NavigationMenu */}
                <NavigationMenu.Root className="hidden md:block">
                    <NavigationMenu.List className="flex items-center gap-1">
                        {NAV_ITEMS.map((item) => {
                            const active = isActive(item.href);
                            return (
                                <NavigationMenu.Item key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={[
                                            "px-3 py-2 rounded-lg text-sm transition ring-1 ring-white/10",
                                            active ? "bg-white text-black font-semibold" : "text-white/80 hover:bg-white/10",
                                        ].join(" ")}
                                        aria-current={active ? "page" : undefined}
                                    >
                                        {item.label}
                                    </Link>
                                </NavigationMenu.Item>
                            );
                        })}
                    </NavigationMenu.List>
                </NavigationMenu.Root>

                {/* Mobile trigger (Radix Dialog as right drawer) */}
                <Dialog.Root open={open} onOpenChange={setOpen}>
                    <Dialog.Trigger asChild>
                        <button
                            type="button"
                            className="md:hidden inline-flex items-center justify-center rounded-lg px-3 py-2 ring-1 ring-white/10 text-white/90 hover:bg-white/10"
                            aria-label="Open navigation"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                                {open ? (
                                    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                ) : (
                                    <path d="M3 6H21M3 12H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                )}
                            </svg>
                        </button>
                    </Dialog.Trigger>

                    <Dialog.Portal>
                        {/* Overlay — highest z-index + fade in/out */}
                        <Dialog.Overlay
                            className={[
                                "fixed inset-0 z-[10000] bg-black/60",
                                "data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
                                "transition-opacity",
                                "data-[state=closed]:pointer-events-none",
                            ].join(" ")}
                        />

                        {/* Drawer panel — highest z-index + slide in/out */}
                        <Dialog.Content
                            aria-label="Mobile navigation"
                            className={[
                                "fixed top-0 right-0 h-dvh w-80 max-w-[85%] bg-black text-white shadow-2xl",
                                "ring-1 ring-white/10 overflow-y-auto z-[10001]",
                                // start off-screen; Radix toggles data-state for animations + transform
                                "translate-x-[calc(100%+8px)] data-[state=open]:translate-x-0",
                                "transition-transform duration-200 ease-out will-change-transform",
                                "data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out",
                            ].join(" ")}
                        >
                            <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
                                <span className="font-semibold">Menu</span>
                                <Dialog.Close asChild>
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center rounded-lg px-2 py-2 ring-1 ring-white/10 text-white/90 hover:bg-white/10"
                                        aria-label="Close navigation"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                                            <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </button>
                                </Dialog.Close>
                            </div>

                            {/* Black buttons that turn white when active (like the reference) */}
                            <nav aria-label="Mobile Primary" className="px-2 py-4 space-y-1">
                                {NAV_ITEMS.map((item, idx) => {
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            ref={idx === 0 ? firstLinkRef : undefined}
                                            className={[
                                                "block px-3 py-2 rounded-lg text-base ring-1 ring-white/10",
                                                active ? "bg-white text-black font-semibold" : "bg-black text-white/90 hover:bg-white/5",
                                            ].join(" ")}
                                            aria-current={active ? "page" : undefined}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            </div>
        </header>
    );
}
