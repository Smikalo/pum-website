"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { useAuth } from "@/context/AuthProvider";
import { toImageSrc } from "@/lib/images";
import { useI18n } from "@/context/I18nProvider";

type NavKey =
    | "home"
    | "members"
    | "projects"
    | "events"
    | "blog"
    | "contact";

type NavItem = { href: string; key: NavKey };

const NAV_ITEMS: NavItem[] = [
    { href: "/", key: "home" },
    { href: "/members", key: "members" },
    { href: "/projects", key: "projects" },
    { href: "/events", key: "events" },
    { href: "/blog", key: "blog" },
    { href: "/contact", key: "contact" },
];

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { lang, setLang, t } = useI18n();

    const [theme, setTheme] = React.useState<"dark" | "light">(() => {
        if (typeof window === "undefined") return "dark";
        const stored = window.localStorage.getItem("theme");
        return stored === "light" || stored === "dark" ? stored : "dark";
    });

    const [mobileOpen, setMobileOpen] = React.useState(false);
    const [loginOpen, setLoginOpen] = React.useState(false);

    const isActive = React.useCallback(
        (href: string) =>
            pathname === href || pathname.startsWith(`${href}/`),
        [pathname],
    );

    // Close mobile drawer on route change
    React.useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Apply theme class + persist
    React.useEffect(() => {
        if (typeof document === "undefined") return;
        const root = document.documentElement;
        const other = theme === "dark" ? "light" : "dark";
        root.classList.remove(other);
        root.classList.add(theme);

        if (typeof window !== "undefined") {
            window.localStorage.setItem("theme", theme);
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    };

    const changeLang = (next: "en" | "de") => {
        if (next === lang) return;

        // Update React context
        setLang(next);

        // Ensure cookie is updated immediately so server + tServer see it
        try {
            const maxAge = 60 * 60 * 24 * 365; // 1 year
            document.cookie = `lang=${encodeURIComponent(
                next,
            )}; path=/; max-age=${maxAge}; samesite=lax`;
        } catch {
            // ignore
        }

        // Re-fetch and re-render the current route so server components
        // and any tServer/tClient content pick up the new language.
        router.refresh();
    };

    return (
        <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
                {/* Brand + tagline */}
                <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-bold text-black">
                            PUM
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold tracking-wide">
                                PUM
                            </span>
                            <span className="hidden text-xs text-white/60 sm:inline">
                                {t("nav.tagline")}
                            </span>
                        </div>
                    </Link>
                </div>

                {/* Desktop nav */}
                <nav className="hidden items-center gap-2 md:flex">
                    {NAV_ITEMS.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={[
                                    "px-3 py-2 rounded-lg text-sm ring-1 ring-white/10 transition",
                                    active
                                        ? "bg-white text-black font-semibold"
                                        : "text-white/80 hover:bg-white/10",
                                ].join(" ")}
                                aria-current={active ? "page" : undefined}
                            >
                                {t(`nav.${item.key}`)}
                            </Link>
                        );
                    })}
                </nav>

                {/* Right side: theme, language, auth, mobile toggle */}
                <div className="flex items-center gap-2">
                    {/* Theme toggle */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="hidden items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 sm:inline-flex"
                    >
                        <ThemeIcon mode={theme} />
                        <span className="sr-only">Toggle theme</span>
                    </button>

                    {/* Language toggle */}
                    <div className="hidden overflow-hidden rounded-lg bg-white/5 text-xs ring-1 ring-white/10 sm:flex">
                        <button
                            type="button"
                            onClick={() => changeLang("en")}
                            className={[
                                "px-2 py-1",
                                lang === "en"
                                    ? "bg-white text-black font-semibold"
                                    : "text-white/80 hover:bg-white/10",
                            ].join(" ")}
                        >
                            EN
                        </button>
                        <button
                            type="button"
                            onClick={() => changeLang("de")}
                            className={[
                                "px-2 py-1",
                                lang === "de"
                                    ? "bg-white text-black font-semibold"
                                    : "text-white/80 hover:bg-white/10",
                            ].join(" ")}
                        >
                            DE
                        </button>
                    </div>

                    {/* Auth (desktop) */}
                    {!user ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setLoginOpen(true)}
                                className="hidden rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black md:inline-flex"
                            >
                                Log in
                            </button>
                            {/* mobile burger */}
                            <button
                                type="button"
                                onClick={() => setMobileOpen(true)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 md:hidden"
                                aria-label="Open navigation"
                            >
                                <MenuIcon />
                            </button>
                        </>
                    ) : (
                        <>
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <button
                                        type="button"
                                        className="hidden h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/10 md:inline-flex"
                                        aria-label="Open account menu"
                                    >
                                        <Avatar
                                            label={
                                                user.member?.name ||
                                                user.email ||
                                                "Profile"
                                            }
                                            src={
                                                user.member
                                                    ? toImageSrc(
                                                        user.member
                                                            .avatarUrl ||
                                                        null,
                                                    )
                                                    : undefined
                                            }
                                        />
                                    </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content className="z-50 mt-1 min-w-[160px] rounded-lg border border-white/10 bg-black/95 p-1 text-sm text-white shadow-xl">
                                    <DropdownMenu.Item asChild>
                                        <Link
                                            href="/account"
                                            className="block rounded-md px-3 py-2 hover:bg-white/10"
                                        >
                                            Profile
                                        </Link>
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                        onSelect={async () => {
                                            await logout();
                                        }}
                                        className="cursor-pointer rounded-md px-3 py-2 text-red-300 hover:bg-white/10"
                                    >
                                        Log out
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Root>

                            {/* Mobile burger */}
                            <button
                                type="button"
                                onClick={() => setMobileOpen(true)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10 md:hidden"
                                aria-label="Open navigation"
                            >
                                <MenuIcon />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile drawer */}
            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
                    <Dialog.Content className="fixed inset-x-0 top-0 z-50 max-h-[100vh] rounded-b-3xl border-b border-white/10 bg-black px-4 pb-6 pt-3 shadow-xl">
                        <div className="flex items-center justify-between pb-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-bold text-black">
                                    PUM
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold tracking-wide">
                                        PUM
                                    </span>
                                    <span className="text-xs text-white/60">
                                        {t("nav.tagline")}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMobileOpen(false)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                                aria-label="Close navigation"
                            >
                                <CloseIcon />
                            </button>
                        </div>

                        {/* Mobile language + theme */}
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => changeLang("en")}
                                    className={[
                                        "rounded-md px-2 py-1 text-xs ring-1 ring-white/10",
                                        lang === "en"
                                            ? "bg-white text-black font-semibold"
                                            : "bg-white/5 text-white/80",
                                    ].join(" ")}
                                >
                                    EN
                                </button>
                                <button
                                    type="button"
                                    onClick={() => changeLang("de")}
                                    className={[
                                        "rounded-md px-2 py-1 text-xs ring-1 ring-white/10",
                                        lang === "de"
                                            ? "bg-white text-black font-semibold"
                                            : "bg-white/5 text-white/80",
                                    ].join(" ")}
                                >
                                    DE
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={toggleTheme}
                                className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-white/80 ring-1 ring-white/10 hover:bg-white/10"
                            >
                                <ThemeIcon mode={theme} />
                                <span className="sr-only">Toggle theme</span>
                            </button>
                        </div>

                        {/* Mobile nav links */}
                        <nav className="flex flex-col gap-1 pb-4">
                            {NAV_ITEMS.map((item) => {
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={[
                                            "w-full rounded-lg px-3 py-2 text-sm ring-1 ring-white/10",
                                            active
                                                ? "bg-white text-black font-semibold"
                                                : "bg-white/5 text-white/80 hover:bg-white/10",
                                        ].join(" ")}
                                        aria-current={
                                            active ? "page" : undefined
                                        }
                                    >
                                        {t(`nav.${item.key}`)}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Mobile auth block */}
                        <div className="border-t border-white/10 pt-4">
                            {!user ? (
                                <LoginForm
                                    mode="drawer"
                                    onSuccess={() => setMobileOpen(false)}
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await logout();
                                        setMobileOpen(false);
                                    }}
                                    className="w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black"
                                >
                                    Log out
                                </button>
                            )}
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Desktop login dialog */}
            <Dialog.Root open={loginOpen} onOpenChange={setLoginOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-black px-5 py-6 shadow-xl">
                        <Dialog.Title className="text-base font-semibold">
                            Log in
                        </Dialog.Title>
                        <Dialog.Description className="mt-1 text-sm text-white/70">
                            Use your Project of United Minds account to sign in.
                        </Dialog.Description>
                        <div className="mt-4">
                            <LoginForm
                                mode="dialog"
                                onSuccess={() => setLoginOpen(false)}
                            />
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </header>
    );
}

type LoginFormProps = {
    mode: "dialog" | "drawer";
    onSuccess?: () => void;
};

function LoginForm({ mode, onSuccess }: LoginFormProps) {
    const { login } = useAuth();
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const canSubmit = email.length > 3 && password.length >= 8 && !loading;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        setError(null);
        try {
            await login(email, password);
            onSuccess?.();
        } catch (err: any) {
            setError(err?.message || "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
                <div className="text-sm text-red-400" role="alert">
                    {error}
                </div>
            )}

            <div className="space-y-1">
                <label
                    htmlFor={`email-${mode}`}
                    className="text-sm text-white/80"
                >
                    Email
                </label>
                <input
                    id={`email-${mode}`}
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-white/30"
                    placeholder="you@example.com"
                />
            </div>

            <div className="space-y-1">
                <label
                    htmlFor={`password-${mode}`}
                    className="text-sm text-white/80"
                >
                    Password
                </label>
                <input
                    id={`password-${mode}`}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-white/30"
                    placeholder="••••••••"
                />
            </div>

            <div className="pt-1">
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
                >
                    {loading ? "Logging in…" : "Log in"}
                </button>
            </div>
        </form>
    );
}

function Avatar({ label, src }: { label: string; src?: string | null }) {
    const initials = React.useMemo(() => {
        const parts = label.split(" ").filter(Boolean);
        const s = (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
        return s.toUpperCase() || "U";
    }, [label]);

    return (
        <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-white text-xs font-bold text-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {src ? (
                <img
                    src={src}
                    alt={label}
                    className="h-full w-full object-cover"
                />
            ) : (
                initials
            )}
        </div>
    );
}

function MenuIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 text-white/80"
        >
            <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 text-white/80"
        >
            <path
                d="M6 6l12 12M18 6l-12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}

function ThemeIcon({ mode }: { mode: "dark" | "light" }) {
    if (mode === "dark") {
        // Moon
        return (
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 text-white/80"
            >
                <path
                    d="M21 12.79A9 9 0 0 1 12.79 3 7 7 0 1 0 21 12.79z"
                    fill="currentColor"
                />
            </svg>
        );
    }
    // Sun
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 text-white/80"
        >
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path
                d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l-1.5-1.5M19.5 19.5 18 18M5 19l-1.5 1.5M19.5 4.5 18 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}
