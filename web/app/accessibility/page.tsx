// web/app/accessibility/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Accessibility Statement",
    description:
        "Our commitment to accessible, inclusive design and technical conformance with WCAG.",
};

const UPDATED = "2025-10-27";

export default function AccessibilityPage() {
    return (
        <section className="section space-y-6">
            <header className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Accessibility Statement</h1>
                <p className="text-white/60">Last updated: {UPDATED}</p>
            </header>

            <article className="prose prose-invert max-w-none">
                <p className="text-white/80">
                    We want everyone to be able to use this website. Our aim is to follow the{" "}
                    <a href="https://www.w3.org/TR/WCAG21/" target="_blank" rel="noreferrer">
                        Web Content Accessibility Guidelines (WCAG) 2.1
                    </a>{" "}
                    at level AA (and adopt 2.2 criteria where feasible).
                </p>

                <h2>Conformance status</h2>
                <p>
                    We strive for <strong>WCAG 2.1 AA</strong> conformance. This includes keyboard
                    accessibility, sufficient color contrast, semantic markup, alternative text for images,
                    focus indicators, predictable navigation, and support for reduced motion.
                </p>

                <h2>Measures we take</h2>
                <ul>
                    <li>Semantic HTML and ARIA only where needed</li>
                    <li>Keyboard operability for interactive controls</li>
                    <li>Visible focus states; skip links (where relevant)</li>
                    <li>Color contrast checks and accessible component primitives</li>
                    <li>Responsive layout and reflow on small screens</li>
                    <li>Captions or transcripts for time-based media (when present)</li>
                    <li>Performance budget for fast loading on assistive tech and mobile</li>
                    <li>Automated and manual accessibility testing as part of CI</li>
                </ul>

                <h2>Known limitations</h2>
                <p>
                    Some embedded third-party content (e.g., maps or external media) may not fully meet WCAG
                    criteria. We provide text alternatives or fallback links where possible.
                </p>

                <h2>Feedback and contact</h2>
                <p>
                    If you encounter an accessibility barrier, please contact us and we will try to remedy it
                    promptly:
                </p>
                <p>
                    Email: <a href="mailto:[ACCESSIBILITY_EMAIL]">[ACCESSIBILITY_EMAIL]</a> <br />
                    Postal address: [ADDRESS]
                </p>

                <h2>Enforcement procedure (for public sector—informational)</h2>
                <p>
                    If you are a public sector body in the EU, the{" "}
                    <a
                        href="https://digital-strategy.ec.europa.eu/en/policies/web-accessibility-directive-standards-and-harmonisation"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Web Accessibility Directive
                    </a>{" "}
                    requires an accessibility statement and sets minimum standards. Although we are a private
                    group, we voluntarily strive to meet the same spirit and technical standards.
                </p>
            </article>
        </section>
    );
}
