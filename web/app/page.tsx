import TypedHeadline from "@/components/TypedHeadline";
import FloatingGallery from "@/components/FloatingGallery";
import StatsStrip from "@/components/StatsStrip";
import LogosMarquee from "@/components/LogosMarquee";
import CTASection from "@/components/CTASection";

export default function Home() {
    return (
        <div className="relative">
            {/* HERO */}
            <section className="section grid md:grid-cols-2 gap-10 items-center">
                <div className="space-y-6">
                    <p className="kicker">PROJECTS OF UNITED MINDS</p>
                    <h1 className="display">
                        We build <span className="underline decoration-white/20">ridiculously fast</span> products for{" "}
                        <span className="whitespace-nowrap"><TypedHeadline /></span>.
                    </h1>
                    <p className="text-white/70 max-w-xl">
                        A collective of TUM makers shipping prototypes, startups and research demos at speed.
                        Code that speaks for itself — secure, performant, production-minded.
                    </p>
                    <div className="pt-2 flex gap-4">
                        <a href="/projects" className="btn-solid">Explore projects</a>
                        <a href="/members"  className="btn-ghost">Meet the team</a>
                    </div>
                </div>
                <div className="grid-bg rounded-[2rem] p-4 fade-up">
                    <FloatingGallery />
                </div>
            </section>

            <StatsStrip />
            <LogosMarquee />

            {/* Feature row (optional, clean and light) */}
            <section className="section grid md:grid-cols-3 gap-6">
                {[
                    { t: "Secure by design", d: "Security headers, rate-limits, and code review gates." },
                    { t: "Performance first", d: "Edge-ready SSR, optimized images, and tiny bundles." },
                    { t: "AI-ready", d: "ML demos and data tooling built into our process." },
                ].map((f)=>(
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
