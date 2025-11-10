import Link from "next/link";
import { tServer } from "@/lib/i18n-server";

export default function CTASection() {
    const title = tServer("cta.workWithPum.title");
    const body = tServer("cta.workWithPum.body");
    const contactLabel = tServer("cta.workWithPum.contact");
    const projectsLabel = tServer("cta.workWithPum.projects");

    return (
        <section className="section">
            <div className="card px-8 py-10 md:px-10 md:py-12 text-center">
                <h3 className="text-2xl md:text-3xl font-bold">{title}</h3>
                <p className="mt-2 text-white/70">{body}</p>
                <div className="mt-6 flex gap-4 justify-center">
                    <Link href="/contact" className="btn-solid">
                        {contactLabel}
                    </Link>
                    <Link href="/projects" className="btn-ghost">
                        {projectsLabel}
                    </Link>
                </div>
            </div>
        </section>
    );
}
