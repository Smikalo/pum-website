// web/app/imprint/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Imprint",
    description:
        "Mandatory site information (Impressum) for digital services under § 5 DDG (formerly § 5 TMG).",
};

export default function ImprintPage() {
    return (
        <section className="section space-y-6">
            <header className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Imprint</h1>
                <p className="text-white/60">
                    Mandatory site information (Impressum) — please replace placeholders with your real data.
                </p>
            </header>

            <article className="prose prose-invert max-w-none">
                <h2>Service Provider (§ 5 DDG)</h2>
                <p>
                    <strong>[ORG_NAME]</strong> <br />
                    [LEGAL_FORM, e.g., “eingetragener Verein (e.V.)” or “GbR” or “GmbH” or “Student group”] <br />
                    [ADDRESS_LINE_1] <br />
                    [ADDRESS_LINE_2] <br />
                    Country: [COUNTRY] <br />
                </p>

                <h3>Contact</h3>
                <p>
                    Email: <a href="mailto:[EMAIL]">[EMAIL]</a> <br />
                    Phone: [PHONE] <br />
                    Website: <a href="https://[DOMAIN]">https://[DOMAIN]</a>
                </p>

                <h3>Authorized Representatives (if applicable)</h3>
                <p>
                    [REPRESENTATIVE_NAME, e.g., Managing Director / Board Member] <br />
                    [REPRESENTATIVE_ADDRESS (optional if same as above)]
                </p>

                <h3>Register & Supervisory information (if applicable)</h3>
                <p>
                    Commercial Register: [REGISTER COURT] — No.: [REGISTER_NO] <br />
                    VAT ID (§ 27a UStG): [VAT_ID] <br />
                    Supervisory Authority (if any): [AUTHORITY_NAME]
                </p>

                <h3>Content Responsibility (only for journalistic/editorial content)</h3>
                <p>
                    If your site contains <em>journalistic-editorial</em> content (e.g., a blog that contributes
                    to public opinion), you must name a responsible person:
                </p>
                <p>
                    <strong>Responsible in accordance with § 18 Abs. 2 MStV:</strong> <br />
                    [FULL_NAME], [ADDRESS (no P.O. box)]
                </p>

                <h3>EU Dispute Resolution / Consumer Arbitration (if applicable)</h3>
                <p>
                    We are neither obligated nor willing to participate in dispute resolution proceedings
                    before a consumer arbitration board. (Adjust if you are obligated.)
                </p>

                <h3>Liability for Contents & Links</h3>
                <p>
                    We carefully curate the content on this website. Nevertheless, we cannot assume liability
                    for the accuracy, completeness or timeliness of content. For external links, the
                    respective providers are responsible.
                </p>

                <h3>Copyright</h3>
                <p>
                    © {new Date().getFullYear()} [ORG_NAME]. Content and works on these pages are subject to
                    copyright. Third-party content is acknowledged as such.
                </p>
            </article>
        </section>
    );
}
