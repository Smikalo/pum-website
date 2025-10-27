import React from "react";
import Link from "next/link";

export default function Footer() {
    const year = new Date().getFullYear();

    const linkClass =
        "hover:underline underline-offset-4 text-white/80 hover:text-white transition";

    return (
        <footer
            role="contentinfo"
            className="mt-16 border-t border-white/10 bg-black/60"
        >
            {/* Top */}
            <div className="section py-10">
                <div className="grid gap-8 md:grid-cols-4">
                    {/* Brand / Mission */}
                    <div className="md:col-span-2">
                        <div className="inline-block rounded-xl px-3 py-1 ring-1 ring-cyan-400/20 bg-cyan-400/5 text-cyan-200 text-xs tracking-widest">
                            PUM — Project of United Minds
                        </div>
                        <h2 className="mt-3 text-xl font-semibold text-white">
                            Cool, initiative TUM students building things that ship.
                        </h2>
                        <p className="mt-2 text-white/70 max-w-prose">
                            We hack, prototype and launch: award-winning projects, startups,
                            and production-grade demos. Connect with us, explore the people
                            behind the builds, and see where we’re headed next.
                        </p>

                        {/* Socials */}
                        <div className="mt-4 flex items-center gap-4">
                            <a
                                aria-label="PUM on GitHub"
                                href="https://github.com/"
                                target="_blank"
                                rel="noreferrer"
                                className="group inline-flex items-center gap-2"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className="w-5 h-5 opacity-80 group-hover:opacity-100"
                                    fill="currentColor"
                                >
                                    <path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56v-2.02c-3.2.7-3.87-1.39-3.87-1.39-.53-1.36-1.3-1.73-1.3-1.73-1.06-.73.08-.72.08-.72 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.74 1.26 3.4.96.1-.76.4-1.26.72-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.2-3.1-.12-.3-.52-1.52.11-3.15 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.63.23 2.85.11 3.15.75.81 1.2 1.84 1.2 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.77 1.07.77 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
                                </svg>
                                <span className="sr-only">GitHub</span>
                            </a>

                            <a
                                aria-label="PUM on LinkedIn"
                                href="https://www.linkedin.com/"
                                target="_blank"
                                rel="noreferrer"
                                className="group inline-flex items-center gap-2"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className="w-5 h-5 opacity-80 group-hover:opacity-100"
                                    fill="currentColor"
                                >
                                    <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V23h-4V8zm7.5 0h3.8v2.05h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V23h-4v-6.5c0-1.55-.03-3.55-2.17-3.55-2.17 0-2.5 1.7-2.5 3.44V23h-4V8z" />
                                </svg>
                                <span className="sr-only">LinkedIn</span>
                            </a>

                            <Link
                                href="/contact"
                                className="group inline-flex items-center gap-2"
                                aria-label="Contact PUM"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    className="w-5 h-5 opacity-80 group-hover:opacity-100"
                                    fill="currentColor"
                                >
                                    <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 2v.01L12 13 4 6.01V6h16ZM4 18V8.24l7.4 6.17a1 1 0 0 0 1.2 0L20 8.24V18H4Z" />
                                </svg>
                                <span className="sr-only">Contact</span>
                            </Link>
                        </div>
                    </div>

                    {/* Quick links */}
                    <div>
                        <h3 className="text-sm font-semibold text-white/90">Explore</h3>
                        <ul className="mt-3 space-y-2 text-sm">
                            <li><Link href="/members" className={linkClass}>Members</Link></li>
                            <li><Link href="/projects" className={linkClass}>Projects</Link></li>
                            <li><Link href="/events" className={linkClass}>Events</Link></li>
                            <li><Link href="/blog" className={linkClass}>Blog</Link></li>
                            <li><Link href="/contact" className={linkClass}>Contact</Link></li>
                        </ul>
                    </div>

                    {/* Legal / meta */}
                    <div>
                        <h3 className="text-sm font-semibold text-white/90">Legal</h3>
                        <ul className="mt-3 space-y-2 text-sm">
                            <li><Link href="/privacy" className={linkClass}>Privacy</Link></li>
                            <li><Link href="/imprint" className={linkClass}>Imprint</Link></li>
                            <li><Link href="/accessibility" className={linkClass}>Accessibility</Link></li>
                        </ul>
                        <div className="mt-4">
                            <a href="#" className="text-xs text-white/60 hover:text-white transition">Back to top ↑</a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom stripe */}
            <div className="border-t border-white/10 bg-black/70">
                <div className="section py-4 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 text-white/60">
                    <div>© {year} PUM — Project of United Minds</div>
                    <div className="flex items-center gap-3">
                        <span className="inline-block w-2 h-2 rounded-full bg-cyan-300 ring-1 ring-white/40 shadow-[0_0_12px_rgba(56,189,248,.9)]" />
                        <span>Made with curiosity & Spezi</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
