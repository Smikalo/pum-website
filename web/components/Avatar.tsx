"use client";

import React from "react";

export type AvatarProps = {
    name: string;
    src?: string | null;
    className?: string;
    size?: number;
};

export default function Avatar({ name, src, className, size = 40 }: AvatarProps) {
    const initials = name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    if (src) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={src}
                alt={name}
                className={`rounded-full object-cover ring-1 ring-white/10 ${className || ""}`}
                style={{ width: size, height: size }}
            />
        );
    }

    return (
        <div
            className={`grid place-items-center rounded-full bg-white/10 ring-1 ring-white/10 text-white/80 ${className || ""}`}
            style={{ width: size, height: size }}
            aria-hidden
        >
            <span className="text-xs font-bold">{initials || "U"}</span>
        </div>
    );
}
