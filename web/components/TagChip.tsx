import React from "react";

type TagChipProps = {
    children: React.ReactNode;
    className?: string;
};

export default function TagChip({ children, className = "" }: TagChipProps) {
    return (
        <span
            className={`text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 ${className}`}
        >
            {children}
        </span>
    );
}