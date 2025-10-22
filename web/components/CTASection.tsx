import Link from "next/link";

export default function CTASection() {
    return (
        <section className="section">
            <div className="card px-8 py-12 md:px-12 md:py-16 text-center">
                <h3 className="text-2xl md:text-3xl font-bold">Work with PUM</h3>
                <p className="mt-2 text-white/70">
                    We team up fast, build faster, and deliver. Recruit us, join us, or sponsor the next big thing.
                </p>
                <div className="mt-8 flex gap-4 justify-center">
                    <Link href="/contact" className="btn-solid">Contact</Link>
                    <Link href="/projects" className="btn-ghost">See projects</Link>
                </div>
            </div>
        </section>
    );
}
