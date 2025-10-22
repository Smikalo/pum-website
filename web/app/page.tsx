import TypedHeadline from "@/components/TypedHeadline";
import FloatingGallery from "@/components/FloatingGallery";
import StatsStrip from "@/components/StatsStrip";
import LogosMarquee from "@/components/LogosMarquee";
import CTASection from "@/components/CTASection";

export default function Home() {
  return (
      <div className="relative">
        {/* HERO */}
        <section className="pt-10 md:pt-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-white/60 tracking-widest text-xs">PROJECTS OF UNITED MINDS</p>
            <h1 className="mt-3 text-4xl md:text-6xl font-extrabold leading-[1.05]">
              We build <span className="underline decoration-white/20">ridiculously fast</span> products for{" "}
              <span className="whitespace-nowrap"><TypedHeadline /></span>.
            </h1>
            <p className="mt-5 text-white/70 max-w-xl">
              A collective of TUM makers shipping prototypes, startups and research demos at speed.
              Code that speaks for itself — secure, performant, and production-minded.
            </p>

            <div className="mt-8 flex gap-4">
              <a href="/projects" className="px-5 py-3 bg-white text-black rounded-xl font-semibold">Explore projects</a>
              <a href="/members"  className="px-5 py-3 border border-white/20 rounded-xl font-semibold">Meet the team</a>
            </div>
          </div>

          <div className="fade-up">
            <FloatingGallery />
          </div>
        </section>

        <StatsStrip />
        <LogosMarquee />
        <CTASection />
      </div>
  );
}
