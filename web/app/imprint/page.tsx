// app/imprint/page.tsx
import React from "react";
import type { Metadata } from "next";
import { tServer } from "@/lib/i18n-server";

export const metadata: Metadata = {
    // Keeping metadata static & English-only for now;
    // if you want it localized per-request you'd use generateMetadata + tServer.
    title: "Imprint – PUM",
    description:
        "Legal notice (Impressum) with provider identification and contact details for this private portfolio website.",
};

export default function ImprintPage() {
    return (
        <section className="section py-10">
            <p className="kicker">{tServer("imprint.kicker")}</p>
            <h1 className="display">{tServer("imprint.title")}</h1>
            <p className="mt-3 text-white/70 max-w-2xl">
                {tServer("imprint.intro")}
            </p>

            <div className="mt-8 grid gap-6 max-w-3xl">
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("imprint.section.provider.title")}
                    </h2>
                    <p className="text-white/80">
                        <strong>{tServer("imprint.section.provider.name")}</strong>
                        <br />
                        {tServer("imprint.section.provider.careOf")}
                        <br />
                        {tServer("imprint.section.provider.street")}
                        <br />
                        {tServer("imprint.section.provider.city")}
                        <br />
                        {tServer("imprint.section.provider.country")}
                    </p>
                    <p className="text-white/80 mt-4">
                        {tServer("imprint.section.provider.body")}
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("imprint.section.contact.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("imprint.section.contact.emailLabel")}{" "}
                        <a
                            href="mailto:contact@the-pum.com"
                            className="underline underline-offset-4"
                        >
                            contact@the-pum.com
                        </a>
                        <br />
                        {tServer("imprint.section.contact.phoneLabel")}{" "}
                        <a
                            href="tel:+4917636089141"
                            className="underline underline-offset-4"
                        >
                            +49&nbsp;176&nbsp;36089141
                        </a>
                        <br />
                        {tServer("imprint.section.contact.webLabel")}{" "}
                        <a
                            href="https://the-pum.de"
                            className="underline underline-offset-4"
                            target="_blank"
                            rel="noreferrer"
                        >
                            https://the-pum.de
                        </a>
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("imprint.section.legalForm.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("imprint.section.legalForm.body")}
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("imprint.section.registerVat.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("imprint.section.registerVat.body")}
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("imprint.section.editorial.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("imprint.section.editorial.bodyPrefix")}
                        <br />
                        <strong>{tServer("imprint.section.editorial.name")}</strong>
                        <br />
                        {tServer("imprint.section.editorial.careOf")}
                        <br />
                        {tServer("imprint.section.editorial.street")}
                        <br />
                        {tServer("imprint.section.editorial.city")}
                        <br />
                        {tServer("imprint.section.editorial.country")}
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("imprint.section.liability.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("imprint.section.liability.body")}
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("imprint.section.copyright.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("imprint.section.copyright.body")}
                    </p>
                </div>

                <div className="text-white/50 text-sm">
                    {tServer("imprint.footer.disclaimer")}
                    <br />
                    <span className="text-white/40">
                        {tServer("imprint.footer.source")}
                    </span>
                </div>
            </div>
        </section>
    );
}
