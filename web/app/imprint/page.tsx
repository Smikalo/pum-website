import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Imprint – PUM",
    description:
        "Legal notice (Impressum) with provider identification and contact details.",
};

export default function ImprintPage() {
    return (
        <section className="section py-10">
            <p className="kicker">LEGAL</p>
            <h1 className="display">Imprint (Impressum)</h1>
            <p className="mt-3 text-white/70 max-w-2xl">
                Provider identification and mandatory information in accordance with
                applicable German law (e.g. TMG).
            </p>

            <div className="mt-8 grid gap-6 max-w-3xl">
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Service Provider</h2>
                    <p className="text-white/80">
                        {/* TODO: Replace with your legal entity/association name */}
                        Project of United Minds (PUM) – student initiative at TUM
                        <br />
                        Arcisstraße 21
                        <br />
                        80333 München
                        <br />
                        Germany
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Contact</h2>
                    <p className="text-white/80">
                        Email: contact@pum.example
                        <br />
                        Web: https://pum.example
                    </p>
                </div>

                {/* Optional legal fields – fill as applicable */}
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Authorized Representative</h2>
                    <p className="text-white/80">
                        {/* e.g., board members of the association */}
                        Max Mustermann &middot; Jane Doe
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        Register / VAT (if applicable)
                    </h2>
                    <p className="text-white/80">
                        Register court &amp; number: —{" "}
                        <span className="text-white/60">(if applicable)</span>
                        <br />
                        VAT ID: DE&nbsp;000000000{" "}
                        <span className="text-white/60">(if applicable)</span>
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Editorial Responsibility</h2>
                    <p className="text-white/80">
                        Responsible for content according to § 18 MStV:
                        <br />
                        Project of United Minds (PUM), address as above.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Liability</h2>
                    <p className="text-white/80">
                        We carefully check external links. Nevertheless, we assume no
                        liability for the content of external websites; the respective
                        providers are responsible for their content. All information on this
                        website is provided without guarantee for completeness, correctness
                        and up-to-dateness.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Copyright</h2>
                    <p className="text-white/80">
                        Texts, photos and graphics are protected by copyright. Please obtain
                        permission before reusing any materials. Where third-party content
                        is used, it is credited accordingly.
                    </p>
                </div>
            </div>
        </section>
    );
}
