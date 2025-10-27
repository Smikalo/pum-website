import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Accessibility Statement – PUM",
    description:
        "Our commitment to accessibility and conformance targets (WCAG).",
};

export default function AccessibilityPage() {
    const updated = new Date().toISOString().slice(0, 10);
    return (
        <section className="section py-10">
            <p className="kicker">LEGAL</p>
            <h1 className="display">Accessibility Statement</h1>
            <p className="mt-3 text-white/70 max-w-2xl">
                We want as many people as possible to use this website. We aim to
                conform to{" "}
                <a
                    href="https://www.w3.org/TR/WCAG22/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                >
                    WCAG&nbsp;2.2
                </a>{" "}
                Level AA.
            </p>

            <div className="mt-8 grid gap-6 max-w-3xl">
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Measures</h2>
                    <ul className="list-disc pl-5 text-white/80 space-y-2">
                        <li>Semantic HTML and accessible component patterns.</li>
                        <li>Keyboard navigation support and visible focus states.</li>
                        <li>Sufficient color contrast and scalable text.</li>
                        <li>Labels for inputs and ARIA where appropriate.</li>
                        <li>Continuous audits and fixing of issues we find.</li>
                    </ul>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Compatibility</h2>
                    <p className="text-white/80">
                        Our site is designed to work with current versions of major
                        browsers, including assistive technologies such as NVDA, VoiceOver
                        and TalkBack on supported platforms.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Feedback & contact</h2>
                    <p className="text-white/80">
                        If you encounter accessibility barriers, please let us know:
                    </p>
                    <ul className="list-disc pl-5 text-white/80 space-y-1">
                        <li>
                            Email:{" "}
                            <a
                                className="underline underline-offset-4"
                                href="mailto:accessibility@pum.example"
                            >
                                accessibility@pum.example
                            </a>
                        </li>
                        <li>
                            Contact form:{" "}
                            <a className="underline underline-offset-4" href="/contact">
                                /contact
                            </a>
                        </li>
                    </ul>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        Enforcement procedure (EU)
                    </h2>
                    <p className="text-white/80">
                        If you are not satisfied with our response, you can contact the
                        competent enforcement body for your country. For guidance on EU
                        accessibility statements and national contacts, see the European
                        Commission resources.
                    </p>
                </div>

                <div className="text-white/50 text-sm">
                    Statement prepared/updated: <time dateTime={updated}>{updated}</time>
                </div>
            </div>
        </section>
    );
}
