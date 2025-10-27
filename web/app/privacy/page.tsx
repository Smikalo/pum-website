// web/app/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "How we process personal data for the PUM website: contact form, server logs, analytics/cookies, your GDPR rights, and how to reach us.",
};

const UPDATED = "2025-10-27"; // update when you change the text

export default function PrivacyPage() {
    return (
        <section className="section space-y-6">
            <header className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
                <p className="text-white/60">Last updated: {UPDATED}</p>
            </header>

            <article className="prose prose-invert max-w-none">
                <p className="text-white/80">
                    This Privacy Policy explains how we process personal data on this website. It is intended
                    to be concise and transparent. <strong>Note:</strong> the information below is for general
                    guidance only and does not constitute legal advice.
                </p>

                <h2>Controller</h2>
                <p>
                    <strong>[ORG_NAME]</strong> <br />
                    [ADDRESS_LINE_1] <br />
                    [ADDRESS_LINE_2] <br />
                    Email: <a href="mailto:[EMAIL]">[EMAIL]</a> <br />
                    Phone: [PHONE] <br />
                </p>

                <h3>Data Protection Contact / DPO (if applicable)</h3>
                <p>
                    Email: <a href="mailto:[DPO_EMAIL]">[DPO_EMAIL]</a> <br />
                    Address: [DPO_ADDRESS]
                </p>

                <h2>What data we process, why, and on what legal basis</h2>
                <h3>Website access (server logs)</h3>
                <p>
                    When you visit our website, our hosting infrastructure may log your IP address, date/time,
                    URL, referrer, and user-agent for security (e.g., to detect abuse) and to ensure stable
                    operation. <em>Legal basis:</em> our legitimate interests (Art. 6(1)(f) GDPR). Logs are
                    retained only as long as necessary for these purposes.
                </p>

                <h3>Contact form</h3>
                <p>
                    If you contact us via the form, we process the data you provide (e.g., name, email,
                    organization, message contents, and your selected contact reason) to handle your request
                    and follow up. <em>Legal basis:</em> Art. 6(1)(b) GDPR (pre-contractual communication) or
                    Art. 6(1)(f) GDPR (our legitimate interests to respond to inquiries). If you consent to be
                    kept informed (e.g., subscribe to updates), <em>Legal basis:</em> Art. 6(1)(a) GDPR.
                </p>

                <h3>Analytics and cookies</h3>
                <p>
                    We use only technically necessary cookies by default. Any non-essential cookies or similar
                    technologies (e.g., analytics, A/B testing, embedded media that set identifiers) are used
                    <strong> only with your consent</strong>. You can withdraw consent at any time via the
                    cookie controls. <em>Legal basis:</em> Art. 6(1)(a) GDPR (consent) and § 25 TDDDG/TTDSG
                    (for storing/reading information on your device). Strictly necessary cookies are used
                    without consent as permitted by § 25(2) TDDDG/TTDSG.
                </p>

                <h3>Newsletter / subscriptions (if enabled)</h3>
                <p>
                    If you opt in, we process your email address to send updates. You can unsubscribe anytime.
                    <em>Legal basis:</em> Art. 6(1)(a) GDPR (consent).
                </p>

                <h2>Recipients and transfers</h2>
                <ul>
                    <li>
                        <strong>Hosting / infrastructure:</strong> [HOSTING_PROVIDER], located in [COUNTRY/EU].
                    </li>
                    <li>
                        <strong>Email / messaging:</strong> [EMAIL_PROVIDER].
                    </li>
                    <li>
                        <strong>Analytics / other services:</strong> [ANALYTICS_TOOL, if any].
                    </li>
                </ul>
                <p>
                    If data is transferred outside the EU/EEA, we ensure appropriate safeguards (e.g., EU
                    Standard Contractual Clauses) and risk assessments.
                </p>

                <h2>Retention</h2>
                <p>
                    We keep data only as long as necessary for the purposes above or to comply with legal
                    obligations. Typical retention: contact requests up to [RETENTION_WINDOW], server logs up
                    to [LOG_RETENTION], and newsletter data until you unsubscribe.
                </p>

                <h2>Your rights under the GDPR</h2>
                <p>
                    You have the right to access, rectification, erasure, restriction, objection (including
                    to processing based on legitimate interests), and data portability. Where processing is
                    based on consent, you may withdraw it at any time with effect for the future.
                </p>
                <p>
                    You also have the right to lodge a complaint with a supervisory authority. Our local
                    authority is e.g. <em>[Supervisory Authority, e.g., Bayerisches Landesamt für
                    Datenschutzaufsicht]</em>.
                </p>

                <h2>Security</h2>
                <p>
                    We implement appropriate technical and organizational measures to protect personal data,
                    including TLS encryption in transit, access controls, and regular reviews of our systems.
                </p>

                <h2>Changes to this notice</h2>
                <p>
                    We may update this policy to reflect changes to our processing or legal requirements. We
                    indicate the latest update date at the top of this page.
                </p>

                <h2>Contact</h2>
                <p>
                    Questions about this policy or your rights? Email{" "}
                    <a href="mailto:[EMAIL]">[EMAIL]</a>.
                </p>
            </article>
        </section>
    );
}
