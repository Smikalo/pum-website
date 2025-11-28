import React from "react";

export interface PageCtaCardProps {
    kicker?: string;
    title: string | React.ReactNode;
    description?: string;
    cta?: React.ReactNode;
    className?: string;
}

export default function PageCtaCard({
                                        kicker,
                                        title,
                                        description,
                                        cta,
                                        className = "",
                                    }: PageCtaCardProps) {
    return (
        <header className={`mb-6 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    {kicker && <p className="kicker">{kicker}</p>}
                    <h1 className="display">{title}</h1>
                    {description && (
                        <p className="mt-3 text-white/70 max-w-2xl">
                            {description}
                        </p>
                    )}
                </div>
                {cta}
            </div>
        </header>
    );
}