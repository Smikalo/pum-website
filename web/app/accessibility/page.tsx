import React from "react";
import type { Metadata } from "next";
import { tServer } from "@/lib/i18n-server";

export const metadata: Metadata = {
    title: "Accessibility Statement – PUM",
    description:
        "Our commitment to accessibility and conformance targets (WCAG).",
};

export default function AccessibilityPage() {
    const updated = new Date().toISOString().slice(0, 10);

    return (
        <section className="section py-10">
            <p className="kicker">{tServer("accessibility.kicker")}</p>
            <h1 className="display">
                {tServer("accessibility.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-white/70">
                {tServer("accessibility.intro.part1")}{" "}
                <a
                    href="https://www.w3.org/TR/WCAG22/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                >
                    {tServer("accessibility.intro.wcagLabel")}
                </a>{" "}
                {tServer("accessibility.intro.part2")}
            </p>

            <div className="mt-8 grid max-w-3xl gap-6">
                <div className="card p-5">
                    <h2 className="mb-2 text-lg font-semibold">
                        {tServer("accessibility.measures.title")}
                    </h2>
                    <ul className="space-y-2 list-disc pl-5 text-white/80">
                        <li>
                            {tServer("accessibility.measures.item1")}
                        </li>
                        <li>
                            {tServer("accessibility.measures.item2")}
                        </li>
                        <li>
                            {tServer("accessibility.measures.item3")}
                        </li>
                        <li>
                            {tServer("accessibility.measures.item4")}
                        </li>
                        <li>
                            {tServer("accessibility.measures.item5")}
                        </li>
                        <li>
                            {tServer("accessibility.measures.item6")}
                        </li>
                    </ul>
                </div>

                <div className="card p-5">
                    <h2 className="mb-2 text-lg font-semibold">
                        {tServer("accessibility.compatibility.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("accessibility.compatibility.body")}
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="mb-2 text-lg font-semibold">
                        {tServer("accessibility.limitations.title")}
                    </h2>
                    <ul className="space-y-2 list-disc pl-5 text-white/80">
                        <li>
                            <strong>
                                {tServer(
                                    "accessibility.limitations.item1.label",
                                )}
                            </strong>{" "}
                            {tServer(
                                "accessibility.limitations.item1.text",
                            )}
                        </li>
                        <li>
                            <strong>
                                {tServer(
                                    "accessibility.limitations.item2.label",
                                )}
                            </strong>{" "}
                            {tServer(
                                "accessibility.limitations.item2.text",
                            )}
                        </li>
                        <li>
                            <strong>
                                {tServer(
                                    "accessibility.limitations.item3.label",
                                )}
                            </strong>{" "}
                            {tServer(
                                "accessibility.limitations.item3.text",
                            )}
                        </li>
                        <li>
                            <strong>
                                {tServer(
                                    "accessibility.limitations.item4.label",
                                )}
                            </strong>{" "}
                            {tServer(
                                "accessibility.limitations.item4.text",
                            )}
                        </li>
                    </ul>
                </div>

                <div className="card p-5">
                    <h2 className="mb-2 text-lg font-semibold">
                        {tServer("accessibility.feedback.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("accessibility.feedback.intro")}
                    </p>
                    <ul className="space-y-1 list-disc pl-5 text-white/80">
                        <li>
                            {tServer(
                                "accessibility.feedback.emailLabel",
                            )}{" "}
                            <a
                                className="underline underline-offset-4"
                                href="mailto:contact@the-pum.com"
                            >
                                contact@the-pum.com
                            </a>
                        </li>
                        <li>
                            {tServer(
                                "accessibility.feedback.contactLabel",
                            )}{" "}
                            <a
                                className="underline underline-offset-4"
                                href="/contact"
                            >
                                /contact
                            </a>
                        </li>
                    </ul>
                    <p className="mt-2 text-sm text-white/60">
                        {tServer("accessibility.feedback.disclaimer")}
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="mb-2 text-lg font-semibold">
                        {tServer("accessibility.legal.title")}
                    </h2>
                    <p className="text-white/80">
                        {tServer("accessibility.legal.body1")}
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                        {tServer("accessibility.legal.body2")}
                    </p>
                </div>

                <div className="text-sm text-white/50">
                    {tServer("accessibility.footer.updatedLabel")}{" "}
                    <time dateTime={updated}>{updated}</time>
                    <br />
                    {tServer("accessibility.footer.disclaimer")}
                </div>
            </div>
        </section>
    );
}
