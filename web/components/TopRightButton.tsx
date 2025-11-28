"use client";

import React from "react";
import Link from "next/link";

type TopRightButtonProps = {
    href?: string;
    children: React.ReactNode;
    className?: string;
    title?: string;
    type?: "button" | "submit";
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

/**
 * A shared wrapper for top-right CTAs in cards and headers.
 * Can render as a Next.js Link (navigational) or a button (interactive).
 *
 * Must be kept purely presentational; do not add auth or role logic here.
 */
export default function TopRightButton({
                                           href,
                                           children,
                                           className,
                                           title,
                                           type = "button",
                                           onClick,
                                       }: TopRightButtonProps) {
    if (href) {
        return (
            <Link href={href} className={className} title={title}>
                {children}
            </Link>
        );
    }

    return (
        <button
            type={type}
            className={className}
            title={title}
            onClick={onClick}
        >
            {children}
        </button>
    );
}