import React from "react";

type PageCtaCardProps = {
    kicker?: string;
    title: React.ReactNode;
    subtitle?: string;
    action?: React.ReactNode;
};

export default function PageCtaCard({ kicker, title, subtitle, action }: PageCtaCardProps) {
    return (
        <header className="mb-6">
            {kicker && <p className="kicker">{kicker}</p>}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="display">{title}</h1>
                    {subtitle && (
                        <p className="mt-3 text-white/70 max-w-2xl">
                            {subtitle}
                        </p>
                    )}
                </div>
                {action}
            </div>
        </header>
    );
}