"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { tClient } from "@/lib/i18n-client";

/**
 * Live search bar using Next.js App Router search params.
 */
export default function MembersSearchBar({
                                             placeholder,
                                             paramKey = "q",
                                             delay = 250,
                                         }: {
    placeholder?: string;
    paramKey?: string;
    delay?: number;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const effectivePlaceholder =
        placeholder || tClient("members.list.search.placeholder");

    const [value, setValue] = React.useState<string>(
        searchParams.get(paramKey) || "",
    );

    React.useEffect(() => {
        const external = searchParams.get(paramKey) || "";
        setValue(external);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    React.useEffect(() => {
        const t = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) params.set(paramKey, value);
            else params.delete(paramKey);
            router.replace(`${pathname}?${params.toString()}`, {
                scroll: false,
            });
        }, delay);
        return () => clearTimeout(t);
    }, [value, searchParams, pathname, router, delay, paramKey]);

    return (
        <div className="relative">
            <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={effectivePlaceholder}
                className="w-full px-4 py-3 rounded-xl bg-black/50 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
                aria-label={tClient("members.search.ariaLabel")}
            />
            {value ? (
                <button
                    type="button"
                    onClick={() => setValue("")}
                    aria-label={tClient("common.clearSearch")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                >
                    {tClient("common.clear")}
                </button>
            ) : null}
        </div>
    );
}
