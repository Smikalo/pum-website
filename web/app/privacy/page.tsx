// app/privacy/page.tsx
import React from "react";
import type { Metadata } from "next";
import { tServer } from "@/lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: tServer("privacy.metadata.title"),
        description: tServer("privacy.metadata.description"),
    };
}

export default function PrivacyPage() {
    const updated = new Date().toISOString().slice(0, 10);

    return (
        <section className="section py-10">
            <p className="kicker">{tServer("privacy.kicker")}</p>
            <h1 className="display">{tServer("privacy.title")}</h1>
            <p className="mt-3 text-white/70 max-w-2xl">
                {tServer("privacy.intro")}
            </p>

            <div className="mt-8 grid gap-6 max-w-3xl">
                {/* 1. Controller */}
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("privacy.section.controller.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("privacy.section.controller.body1")}
                    </p>
                    <p className="text-white/80 mt-3">
                        <strong>{tServer("privacy.section.controller.name")}</strong>
                        <br />
                        {tServer("privacy.section.controller.careOf")}
                        <br />
                        {tServer("privacy.section.controller.street")}
                        <br />
                        {tServer("privacy.section.controller.city")}
                        <br />
                        {tServer("privacy.section.controller.country")}
                    </p>
                    <p className="text-white/80 mt-3">
                        {tServer("privacy.section.controller.body2")}
                        <br />
                        <br />
                        {tServer("privacy.section.controller.emailPrefix")}{" "}
                        <a
                            className="underline underline-offset-4"
                            href="mailto:contact@the-pum.com"
                        >
                            contact@the-pum.com
                        </a>
                        .
                    </p>
                </div>

                {/* 2. What data we process & why */}
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("privacy.section.data.title")}
                    </h2>
                    <ul className="list-disc pl-5 text-white/80 space-y-2">
                        <li>
                            <strong>
                                {tServer("privacy.section.data.serverLogs.label")}
                            </strong>{" "}
                            {tServer("privacy.section.data.serverLogs.text")}
                        </li>
                        <li>
                            <strong>
                                {tServer("privacy.section.data.contact.label")}
                            </strong>{" "}
                            {tServer("privacy.section.data.contact.text")}
                        </li>
                        <li>
                            <strong>
                                {tServer("privacy.section.data.accounts.label")}
                            </strong>{" "}
                            {tServer("privacy.section.data.accounts.text")}
                        </li>
                        <li>
                            <strong>
                                {tServer("privacy.section.data.integrations.label")}
                            </strong>{" "}
                            {tServer("privacy.section.data.integrations.text")}
                        </li>
                        <li>
                            <strong>
                                {tServer("privacy.section.data.preferences.label")}
                            </strong>{" "}
                            {tServer("privacy.section.data.preferences.text")}
                        </li>
                    </ul>
                </div>

                {/* 3. Cookies, local storage & analytics */}
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("privacy.section.cookies.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("privacy.section.cookies.intro")}
                    </p>
                    <ul className="list-disc pl-5 text-white/80 space-y-2 mt-2">
                        <li>{tServer("privacy.section.cookies.item1")}</li>
                        <li>{tServer("privacy.section.cookies.item2")}</li>
                        <li>{tServer("privacy.section.cookies.item3")}</li>
                    </ul>
                    <p className="text-white/60 text-sm mt-2">
                        {tServer("privacy.section.cookies.footer")}
                    </p>
                </div>

                {/* 4. Recipients & data transfers */}
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("privacy.section.recipients.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("privacy.section.recipients.body1")}
                    </p>
                    <p className="text-white/80 mt-2">
                        {tServer("privacy.section.recipients.body2")}
                    </p>

                    <div className="mt-4">
                        <h3 className="font-semibold text-white mb-1 text-sm">
                            {tServer("privacy.section.recipients.ip.heading")}
                        </h3>
                        <p className="text-white/80 text-sm">
                            {tServer("privacy.section.recipients.ip.body1")}
                        </p>
                        <p className="text-white/80 text-sm mt-2">
                            {tServer("privacy.section.recipients.ip.body2")}{" "}
                            <a
                                className="underline underline-offset-4"
                                href="https://impressum-privatschutz.de/datenschutzerklaerung/"
                                target="_blank"
                                rel="noreferrer"
                            >
                                https://impressum-privatschutz.de/datenschutzerklaerung/
                            </a>
                            .
                        </p>
                    </div>
                </div>

                {/* 5. Retention */}
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("privacy.section.retention.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("privacy.section.retention.intro")}
                    </p>
                    <ul className="list-disc pl-5 text-white/80 space-y-2 mt-2">
                        <li>{tServer("privacy.section.retention.item1")}</li>
                        <li>{tServer("privacy.section.retention.item2")}</li>
                        <li>{tServer("privacy.section.retention.item3")}</li>
                        <li>{tServer("privacy.section.retention.item4")}</li>
                    </ul>
                </div>

                {/* 6. Your rights */}
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("privacy.section.rights.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("privacy.section.rights.intro")}
                    </p>
                    <ul className="list-disc pl-5 text-white/80 space-y-1 mt-2">
                        <li>{tServer("privacy.section.rights.item.access")}</li>
                        <li>{tServer("privacy.section.rights.item.rectification")}</li>
                        <li>{tServer("privacy.section.rights.item.erasure")}</li>
                        <li>{tServer("privacy.section.rights.item.restriction")}</li>
                        <li>{tServer("privacy.section.rights.item.portability")}</li>
                        <li>{tServer("privacy.section.rights.item.object")}</li>
                        <li>{tServer("privacy.section.rights.item.consent")}</li>
                    </ul>
                    <p className="text-white/80 mt-3">
                        {tServer("privacy.section.rights.complaint")}
                    </p>
                    <p className="text-white/60 text-sm mt-2">
                        {tServer("privacy.section.rights.supervisoryPrefix")}{" "}
                        <a
                            className="underline underline-offset-4"
                            href="https://www.lda.bayern.de/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {tServer("privacy.section.rights.supervisoryLinkLabel")}
                        </a>
                        .
                    </p>
                </div>

                {/* 7. Contact */}
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        {tServer("privacy.section.contact.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("privacy.section.contact.body")}
                        {" "}
                        <a
                            className="underline underline-offset-4"
                            href="mailto:contact@the-pum.com"
                        >
                            contact@the-pum.com
                        </a>{" "}
                        {tServer("privacy.section.contact.bodySuffix")}{" "}
                        <a
                            className="underline underline-offset-4"
                            href="/contact"
                        >
                            {tServer("privacy.section.contact.linkLabel")}
                        </a>
                        .
                    </p>
                </div>

                {/* Footer */}
                <div className="text-white/50 text-sm">
                    {tServer("privacy.footer.updatedLabel")}{" "}
                    <time dateTime={updated}>{updated}</time>
                    <br />
                    <span>{tServer("privacy.footer.disclaimer")}</span>
                </div>
            </div>
        </section>
    );
}
