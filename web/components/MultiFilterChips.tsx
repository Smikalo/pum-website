import Link from "next/link";
import React from "react";

type MultiFilterChipsProps = {
    base: string;
    params: Record<string, string>;
    values: string[];
    selected: string[];
    name: string;
    clearLabel: string;
};

export default function MultiFilterChips({
                                             base,
                                             params,
                                             values,
                                             selected,
                                             name,
                                             clearLabel,
                                         }: MultiFilterChipsProps) {
    const makeHref = (nextSelected: string[]) => {
        const p = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v) p.set(k, v);
        });
        if (nextSelected.length) p.set(name, nextSelected.join(","));
        const qs = p.toString();
        return `${base}${qs ? `?${qs}` : ""}`;
    };

    const toggle = (v: string) => {
        const exists = selected.includes(v);
        const next = exists
            ? selected.filter((s) => s !== v)
            : [...selected, v];
        return makeHref(next);
    };

    return (
        <>
            {selected.length > 0 && (
                <Link
                    href={makeHref([])}
                    className="px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 bg-white/10 hover:bg-white/20 transition"
                >
                    {clearLabel}
                </Link>
            )}
            {values.map((v) => (
                <Link
                    key={v}
                    href={toggle(v)}
                    className={`px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 transition ${
                        selected.includes(v)
                            ? "bg-white text-black font-semibold"
                            : "bg-white/5 hover:bg-white/10"
                    }`}
                >
                    {v}
                </Link>
            ))}
        </>
    );
}