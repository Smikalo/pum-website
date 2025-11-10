// web/app/page.tsx
import TypedHeadline from "@/components/TypedHeadline";
import FloatingGallery from "@/components/FloatingGallery";
import StatsStrip from "@/components/StatsStrip";
import LogosMarquee from "@/components/LogosMarquee";
import CTASection from "@/components/CTASection";
import { tServer } from "@/lib/i18n-server";

export default function Home() {
    const featureItems = [
        {
            t: tServer("home.features.secure.title"),
            d: tServer("home.features.secure.body"),
        },
        {
            t: tServer("home.features.performance.title"),
            d: tServer("home.features.performance.body"),
        },
        {
            t: tServer("home.features.ai.title"),
            d: tServer("home.features.ai.body"),
        },
    ];

    return (
        <div className="relative">
            {/* HERO */}
            <section className="section grid md:grid-cols-2 gap-10 items-center">
                <div className="space-y-6">
                    <p className="kicker">
                        {tServer("home.hero.kicker")}
                    </p>
                    <h1 className="display">
                        {tServer("home.hero.title.prefix")}{" "}
                        <span className="underline decoration-white/20">
                            {tServer("home.hero.title.highlight")}
                        </span>{" "}
                        {tServer("home.hero.title.suffix")}
                        <p>
                            {" "}
                            <span className="whitespace-nowrap">
                                <TypedHeadline />
                            </span>
                        </p>
                    </h1>
                    <p className="text-white/70 max-w-xl">
                        {tServer("home.hero.subtitle")}
                    </p>
                    <div className="pt-2 flex gap-4">
                        <a href="/projects" className="btn-solid">
                            {tServer("home.hero.cta.projects")}
                        </a>
                        <a href="/members" className="btn-ghost">
                            {tServer("home.hero.cta.members")}
                        </a>
                    </div>
                </div>
                <div className="grid-bg rounded-[2rem] p-4 fade-up">
                    <FloatingGallery />
                </div>
            </section>

            <StatsStrip />
            <LogosMarquee />

            {/* Feature row */}
            <section className="section grid md:grid-cols-3 gap-6">
                {featureItems.map((f) => (
                    <div key={f.t} className="card p-8">
                        <h3 className="text-xl font-bold">{f.t}</h3>
                        <p className="mt-2 text-white/70">{f.d}</p>
                    </div>
                ))}
            </section>

            <CTASection />
        </div>
    );
}
