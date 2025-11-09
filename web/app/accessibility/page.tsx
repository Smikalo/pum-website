import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Accessibility Statement – PUM",
    description: "Our commitment to accessibility and conformance targets (WCAG).",
};

export default function AccessibilityPage() {
    const updated = new Date().toISOString().slice(0, 10);
    return (
        <section className="section py-10">
            <p className="kicker">LEGAL</p>
            <h1 className="display">Accessibility Statement</h1>
            <p className="mt-3 text-white/70 max-w-2xl">
                We want as many people as possible to be able to use this website. PUM is a
                small, private, non-commercial portfolio and project site run by a group of
                friends/students, not a public-sector body. We nevertheless aim to follow the
                principles of{" "}
                <a
                    href="https://www.w3.org/TR/WCAG22/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                >
                    WCAG&nbsp;2.2
                </a>{" "}
                Level AA as far as is reasonably possible for us.
            </p>

            <div className="mt-8 grid gap-6 max-w-3xl">
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Measures</h2>
                    <ul className="list-disc pl-5 text-white/80 space-y-2">
                        <li>Semantic HTML and accessible component patterns where possible.</li>
                        <li>Keyboard navigation support and visible focus states.</li>
                        <li>
                            Sufficient color contrast and scalable text where it does not break the
                            design.
                        </li>
                        <li>Labels for inputs and ARIA attributes where appropriate.</li>
                        <li>Respect for system preferences such as “reduced motion”.</li>
                        <li>Ongoing, best-effort fixes when we notice or are told about issues.</li>
                    </ul>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Compatibility</h2>
                    <p className="text-white/80">
                        Our site is designed to work with current versions of major browsers
                        (for example, Chrome, Firefox, Safari, Edge) on desktop and mobile.
                        We try to support assistive technologies such as NVDA, VoiceOver and
                        TalkBack on supported platforms, but we cannot test every combination.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Known limitations</h2>
                    <ul className="list-disc pl-5 text-white/80 space-y-2">
                        <li>
                            <strong>Interactive maps and third-party content:</strong> Map and
                            geocoding features may rely on third-party libraries and map tiles
                            which are not fully keyboard or screen-reader accessible.
                        </li>
                        <li>
                            <strong>Visual effects and animations:</strong> Some visual
                            components (such as animated graphics, logo tickers, or typing
                            effects) may be harder to use for some people. Where possible we
                            take system “reduced motion” settings into account, but there may
                            still be motion on the page.
                        </li>
                        <li>
                            <strong>User-generated content:</strong> Images, PDFs or other
                            files uploaded by users (for example, project screenshots or CVs)
                            may not be fully accessible.
                        </li>
                        <li>
                            <strong>Languages:</strong> The primary content language of this
                            site is English. Some parts of the interface can be switched
                            between English and German, but not all content is available in
                            both languages yet.
                        </li>
                    </ul>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Feedback &amp; contact</h2>
                    <p className="text-white/80">
                        If you encounter accessibility barriers, please let us know – we are
                        maintaining this project next to our studies/jobs and appreciate
                        constructive feedback:
                    </p>
                    <ul className="list-disc pl-5 text-white/80 space-y-1">
                        <li>
                            Email:{" "}
                            <a
                                className="underline underline-offset-4"
                                href="mailto:contact@the-pum.com"
                            >
                                contact@the-pum.com
                            </a>
                        </li>
                        <li>
                            Contact form:{" "}
                            <a className="underline underline-offset-4" href="/contact">
                                /contact
                            </a>
                        </li>
                    </ul>
                    <p className="text-white/60 text-sm mt-2">
                        We will do our best to respond and fix issues, but as this is a
                        private side project, response times may vary.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        Legal background &amp; enforcement
                    </h2>
                    <p className="text-white/80">
                        Many EU rules on web accessibility and formal accessibility statements
                        are aimed at public-sector bodies and certain commercial services.
                        PUM is a private, non-registered project and is therefore typically
                        not in the same legal category as public administrations or large
                        service providers. Nevertheless, we voluntarily publish this
                        accessibility statement and work on improvements where we can.
                    </p>
                    <p className="text-white/60 text-sm mt-2">
                        If you are not satisfied with our response to accessibility feedback,
                        you can contact local disability advocacy organisations or general
                        consumer advice centres in your country for further guidance.
                    </p>
                </div>

                <div className="text-white/50 text-sm">
                    Statement prepared/updated: <time dateTime={updated}>{updated}</time>
                    <br />
                    This statement is provided on a best-effort basis and does not constitute
                    legal advice.
                </div>
            </div>
        </section>
    );
}
