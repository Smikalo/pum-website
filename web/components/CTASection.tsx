import Link from "next/link";

export default function CTASection() {
    return (
        <section className="mt-16 card p-8 md:p-10 text-center">
            <h3 className="text-2xl md:text-3xl font-bold">Work with PUM</h3>
            <p className="mt-2 text-white/70">
                We team up fast, build faster, and deliver. Recruit us, join us, or sponsor the next big thing.
            </p>
            <div className="mt-6 flex gap-4 justify-center">
                <Link href="/contact" className="px-5 py-3 bg-white text-black rounded-xl font-semibold">Contact</Link>
                <Link href="/projects" className="px-5 py-3 border border-white/20 rounded-xl font-semibold">See projects</Link>
            </div>
        </section>
    );
}
