"use client";

import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
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
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const [drawerView, setDrawerView] = React.useState<"menu" | "settings" | "login">("menu");
    const firstLinkRef = React.useRef<HTMLAnchorElement | null>(null);

    // desktop login dialog
    const [loginOpen, setLoginOpen] = React.useState(false);

    // settings (theme + language)
    const [theme, setTheme] = React.useState<"dark" | "light">(
        (typeof window !== "undefined" && (localStorage.getItem("theme") as "dark" | "light")) || "dark",
    );
    const [lang, setLang] = React.useState<"en" | "de">(
        (typeof window !== "undefined" && (localStorage.getItem("lang") as "en" | "de")) || "en",
    );

    React.useEffect(() => setDrawerOpen(false), [pathname]);
    React.useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setDrawerOpen(false);
                setLoginOpen(false);
                setDrawerView("menu");
            }
        }
        if (drawerOpen || loginOpen) window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [drawerOpen, loginOpen]);

    React.useEffect(() => {
        if (drawerOpen && drawerView === "menu") firstLinkRef.current?.focus();
    }, [drawerOpen, drawerView]);

    // apply theme/lang
    React.useEffect(() => {
        if (typeof document !== "undefined") {
            const root = document.documentElement;
            root.classList.remove(theme === "dark" ? "light" : "dark");
            root.classList.add(theme);
            localStorage.setItem("theme", theme);
        }
    }, [theme]);
    React.useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("lang", lang);
            window.dispatchEvent(new CustomEvent("pum:lang", { detail: { lang } }));
        }
    }, [lang]);

    const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

    // --- Desktop gear animation (spin cw on open, ccw on close) ---
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [gearAnim, setGearAnim] = React.useState<"idle" | "open" | "close">("idle");
    const handleSettingsOpenChange = (o: boolean) => {
        setSettingsOpen(o);
        setGearAnim(o ? "open" : "close");
    };

    return (
        <header className="sticky top-0 z-50 bg-black/60 backdrop-blur border-b border-white/10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Brand */}
                <div className="flex items-center gap-3">
                    <Link href="/" className="font-extrabold tracking-tight text-white text-lg">PUM</Link>
                    <span className="hidden sm:inline text-white/40 text-sm">Project of United Minds</span>
                </div>

                {/* Desktop nav */}
                <div className="hidden md:flex items-center gap-3">
                    <NavigationMenu.Root>
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

                    {/* SETTINGS: round gear button -> DropdownMenu (list only) */}
                    <DropdownMenu.Root open={settingsOpen} onOpenChange={handleSettingsOpenChange}>
                        <DropdownMenu.Trigger asChild>
                            <button
                                type="button"
                                aria-label="Open settings"
                                className={[
                                    "w-9 h-9 rounded-full grid place-items-center ring-1 ring-white/10 text-white/90",
                                    "hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                                ].join(" ")}
                            >
                                {/* Wrap to catch animation end and reset */}
                                <span
                                    onAnimationEnd={() => setGearAnim("idle")}
                                    className={[
                                        gearAnim === "open" ? "gear-anim-open" : "",
                                        gearAnim === "close" ? "gear-anim-close" : "",
                                    ].join(" ")}
                                >
                  <GearIcon />
                </span>
                            </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Content
                            align="end"
                            sideOffset={8}
                            className="min-w-[220px] rounded-lg bg-black text-white shadow-2xl ring-1 ring-white/10 p-1"
                        >
                            {/* A simple list — no right-side controls */}
                            <DropdownSection label="Theme" />
                            <DropdownMenu.Item
                                onSelect={() => setTheme("dark")}
                                className="px-3 py-2 rounded-md text-sm outline-none cursor-pointer hover:bg-white/10 data-[highlighted]:bg-white/10"
                            >
                                Dark
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                onSelect={() => setTheme("light")}
                                className="px-3 py-2 rounded-md text-sm outline-none cursor-pointer hover:bg-white/10 data-[highlighted]:bg-white/10"
                            >
                                Light
                            </DropdownMenu.Item>

                            <div className="my-1 h-px bg-white/10" />

                            <DropdownSection label="Language" />
                            <DropdownMenu.Item
                                onSelect={() => setLang("en")}
                                className="px-3 py-2 rounded-md text-sm outline-none cursor-pointer hover:bg-white/10 data-[highlighted]:bg-white/10"
                            >
                                English
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                onSelect={() => setLang("de")}
                                className="px-3 py-2 rounded-md text-sm outline-none cursor-pointer hover:bg-white/10 data-[highlighted]:bg-white/10"
                            >
                                Deutsch
                            </DropdownMenu.Item>

                            <div className="my-1 h-px bg-white/10" />

                            <DropdownMenu.Item
                                onSelect={() => setLoginOpen(true)}
                                className="px-3 py-2 rounded-md text-sm outline-none cursor-pointer hover:bg-white/10 data-[highlighted]:bg-white/10"
                            >
                                Log in
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Root>
                </div>

                {/* Mobile: hamburger -> Drawer */}
                <Dialog.Root
                    open={drawerOpen}
                    onOpenChange={(o) => {
                        setDrawerOpen(o);
                        if (!o) setDrawerView("menu");
                    }}
                >
                    <Dialog.Trigger asChild>
                        <button
                            type="button"
                            className="md:hidden inline-flex items-center justify-center rounded-lg px-3 py-2 ring-1 ring-white/10 text-white/90 hover:bg-white/10"
                            aria-label="Open navigation"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                                {drawerOpen ? (
                                    <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                ) : (
                                    <path d="M3 6H21M3 12H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                )}
                            </svg>
                        </button>
                    </Dialog.Trigger>

                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 z-[10000] bg-black/60 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out transition-opacity data-[state=closed]:pointer-events-none" />
                        <Dialog.Content
                            aria-label="Mobile navigation"
                            className={[
                                "fixed top-0 right-0 h-dvh w-80 max-w-[85%] bg-black text-white shadow-2xl",
                                "ring-1 ring-white/10 overflow-y-auto z-[10001]",
                                "translate-x-[calc(100%+8px)] data-[state=open]:translate-x-0",
                                "transition-transform duration-200 ease-out will-change-transform",
                            ].join(" ")}
                        >
                            <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
                                {drawerView !== "menu" ? (
                                    <button
                                        type="button"
                                        onClick={() => setDrawerView("menu")}
                                        className="inline-flex items-center gap-2 rounded-lg px-2 py-2 ring-1 ring-white/10 text-white/90 hover:bg-white/10"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                                            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Back
                                    </button>
                                ) : (
                                    <span className="font-semibold">Menu</span>
                                )}
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

                            {/* MAIN VIEW */}
                            {drawerView === "menu" && (
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

                                    {/* “Sub-pages” inside the drawer (no icon for Settings) */}
                                    <button
                                        type="button"
                                        onClick={() => setDrawerView("settings")}
                                        className="w-full text-left mt-2 block px-3 py-2 rounded-lg text-base ring-1 ring-white/10 bg-black text-white/90 hover:bg-white/5"
                                    >
                                        Settings
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDrawerView("login")}
                                        className="w-full text-left mt-2 block px-3 py-2 rounded-lg text-base ring-1 ring-white/10 bg-black text-white/90 hover:bg-white/5"
                                    >
                                        Log in
                                    </button>
                                </nav>
                            )}

                            {/* SETTINGS SUBPAGE (list only; same items as desktop dropdown) */}
                            {drawerView === "settings" && (
                                <div className="p-3 space-y-1">
                                    <MobileSection label="Theme" />
                                    <button onClick={() => setTheme("dark")} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/10">Dark</button>
                                    <button onClick={() => setTheme("light")} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/10">Light</button>
                                    <div className="my-1 h-px bg-white/10" />
                                    <MobileSection label="Language" />
                                    <button onClick={() => setLang("en")} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/10">English</button>
                                    <button onClick={() => setLang("de")} className="w-full text-left px-3 py-2 rounded-md hover:bg-white/10">Deutsch</button>
                                </div>
                            )}

                            {/* LOGIN SUBPAGE (simple form; UI only) */}
                            {drawerView === "login" && (
                                <div className="p-4">
                                    <h3 className="text-lg font-semibold mb-2">Log in</h3>
                                    <LoginForm onSubmit={() => setDrawerOpen(false)} />
                                </div>
                            )}
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            </div>

            {/* Desktop login dialog (triggered from gear dropdown “Log in”) */}
            <Dialog.Root open={loginOpen} onOpenChange={setLoginOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[11000] bg-black/60 data-[state=open]:animate-overlay-in" />
                    <Dialog.Content
                        className="fixed left-1/2 top-1/2 z-[11001] -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-black ring-1 ring-white/10 p-5 shadow-2xl"
                        aria-label="Login"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold">Log in</h3>
                            <Dialog.Close asChild>
                                <button className="rounded-md px-2 py-1 ring-1 ring-white/10 hover:bg-white/10" aria-label="Close">✕</button>
                            </Dialog.Close>
                        </div>
                        <LoginForm onSubmit={() => setLoginOpen(false)} />
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* local CSS for gear animation */}
            <style jsx>{`
        @keyframes gear-open {
          from { transform: rotate(0deg); }
          to   { transform: rotate(180deg); }
        }
        @keyframes gear-close {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-180deg); }
        }
        .gear-anim-open { animation: gear-open 220ms linear; }
        .gear-anim-close { animation: gear-close 220ms linear; }
      `}</style>
        </header>
    );
}

/* ----------------------------- small pieces ----------------------------- */

function DropdownSection({ label }: { label: string }) {
    return <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-widest text-white/50">{label}</div>;
}
function MobileSection({ label }: { label: string }) {
    return <div className="px-1 pt-1 pb-2 text-[11px] uppercase tracking-widest text-white/50">{label}</div>;
}

function LoginForm({ onSubmit }: { onSubmit: () => void }) {
    const [email, setEmail] = React.useState("");
    const [pw, setPw] = React.useState("");
    const canSubmit = email.length > 3 && pw.length >= 8;

    function submit(e: React.FormEvent) {
        e.preventDefault();
        // UI only for now; hook API later.
        onSubmit();
    }

    return (
        <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
                <label htmlFor="email" className="text-sm text-white/80">Email</label>
                <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm outline-none focus:ring-white/30"
                />
            </div>
            <div className="space-y-1">
                <label htmlFor="password" className="text-sm text-white/80">Password</label>
                <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm outline-none focus:ring-white/30"
                />
                <p className="text-xs text-white/50">At least 8 characters.</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
                <Dialog.Close asChild>
                    <button type="button" className="px-3 py-2 rounded-md ring-1 ring-white/10 hover:bg-white/10 text-sm">
                        Cancel
                    </button>
                </Dialog.Close>
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="px-3 py-2 rounded-md bg-white text-black text-sm font-semibold disabled:opacity-40"
                >
                    Log in
                </button>
            </div>
        </form>
    );
}

function GearIcon({ className = "" }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
                d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5c0-.5 0-1-.1-1.4l2-1.6-2-3.5-2.5 1a7.7 7.7 0 0 0-2.3-1.3l-.4-2.7h-4l-.4 2.7c-.8.3-1.6.7-2.3 1.3l-2.5-1-2 3.5 2 1.6c0 .5-.1.9-.1 1.4s0 1 .1 1.4l-2 1.6 2 3.5 2.5-1c.7.6 1.5 1 2.3 1.3l.4 2.7h4l.4-2.7c.8-.3 1.6-.7 2.3-1.3l2.5 1 2-3.5-2-1.6c.1-.4.1-.9.1-1.4Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
            />
        </svg>
    );
}
