// web/components/MembersSearchBar.tsx
"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Live search bar using Next.js App Router search params.
 * - Debounced updates with router.replace (no scroll jump).
 * - Keeps other existing query params intact.
 * Docs: useSearchParams / useRouter in App Router.
 */
export default function MembersSearchBar({
                                             placeholder = "Search…",
                                             paramKey = "q",
                                             delay = 250,
                                         }: {
    placeholder?: string;
    paramKey?: string;
    delay?: number;
}) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const initial = searchParams.get(paramKey) || "";
    const [value, setValue] = React.useState(initial);

    // keep local value in sync if url changes (eg. back/forward)
    React.useEffect(() => {
        if (initial !== value) setValue(initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initial]);

    // debounce updates into the URL
    React.useEffect(() => {
        const t = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) params.set(paramKey, value);
            else params.delete(paramKey);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }, delay);
        return () => clearTimeout(t);
    }, [value, searchParams, pathname, router, delay, paramKey]);

    return (
        <div className="relative">
            <input
                value={value}
                onChange={(e)=>setValue(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-3 rounded-xl bg-black/50 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
                aria-label="Search members"
            />
            {value ? (
                <button
                    type="button"
                    onClick={() => setValue("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                >
                    Clear
                </button>
            ) : null}
        </div>
    );
}
