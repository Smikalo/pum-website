import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy – PUM",
    description: "How we handle your personal data and your rights.",
};

export default function PrivacyPage() {
    const updated = new Date().toISOString().slice(0, 10);
    return (
        <section className="section py-10">
            <p className="kicker">LEGAL</p>
            <h1 className="display">Privacy Policy</h1>
            <p className="mt-3 text-white/70 max-w-2xl">
                We respect your privacy. This page explains what personal data we
                process, for what purposes, and how you can exercise your rights.
            </p>

            <div className="mt-8 grid gap-6 max-w-3xl">
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">1. Controller</h2>
                    <p className="text-white/80">
                        <strong>Project of United Minds (PUM)</strong>
                        <br />
                        {/* TODO: Replace with your legal/official contact details */}
                        c/o TUM student group
                        <br />
                        Arcisstraße 21, 80333 München, Germany
                        <br />
                        Email: contact@pum.example
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        2. What data we process & why
                    </h2>
                    <ul className="list-disc pl-5 text-white/80 space-y-2">
                        <li>
                            <strong>Website usage data</strong> (e.g., pages viewed, referrer,
                            browser/OS, approximate location) to operate and secure our site
                            (legitimate interests, Art. 6(1)(f) GDPR).
                        </li>
                        <li>
                            <strong>Contact form data</strong> (name, email, message) to
                            respond to your request (performance of a contract / steps prior
                            to entering into a contract, Art. 6(1)(b); or consent, Art.
                            6(1)(a) GDPR).
                        </li>
                        <li>
                            <strong>Community/portfolio content</strong> you choose to share
                            (member profiles, project info, event stories) for publishing on
                            the website (consent, Art. 6(1)(a) GDPR).
                        </li>
                        <li>
                            <strong>Cookies & analytics</strong> only if explicitly enabled
                            by you (consent, Art. 6(1)(a) GDPR). See “Cookies” below.
                        </li>
                    </ul>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">3. Cookies & analytics</h2>
                    <p className="text-white/80">
                        We aim to run this website with minimal cookies. If we use
                        analytics, we will ask for your consent via the banner and load
                        analytics scripts only after consent. You can withdraw consent at
                        any time via the cookie settings.
                    </p>
                    <p className="text-white/60 text-sm mt-2">
                        {/* Optional link target you can wire later */}
                        <a className="underline underline-offset-4" href="#cookie-settings">
                            Open cookie settings
                        </a>
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        4. Recipients & transfers
                    </h2>
                    <p className="text-white/80">
                        We may use service providers (hosting, analytics, form processing)
                        under data-processing agreements. If data is transferred to
                        countries outside the EU/EEA, we ensure appropriate safeguards (e.g.
                        Standard Contractual Clauses) or ask for your consent where
                        required.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">5. Retention</h2>
                    <p className="text-white/80">
                        We keep personal data only as long as necessary for the stated
                        purposes, legal obligations, or the defense of legal claims.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">6. Your rights</h2>
                    <p className="text-white/80">
                        You have the right to access, rectify, erase, restrict or object to
                        processing, data portability, and to withdraw consent with effect
                        for the future. You can also lodge a complaint with a data
                        protection authority.
                    </p>
                    <p className="text-white/60 text-sm mt-2">
                        In Bavaria, the competent authority is typically the{" "}
                        <a
                            className="underline underline-offset-4"
                            href="https://www.lda.bayern.de/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Bayerisches Landesamt f&uuml;r Datenschutzaufsicht (BayLDA)
                        </a>
                        .
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">7. Contact</h2>
                    <p className="text-white/80">
                        For privacy requests, write to{" "}
                        <a
                            className="underline underline-offset-4"
                            href="mailto:privacy@pum.example"
                        >
                            privacy@pum.example
                        </a>{" "}
                        or use our{" "}
                        <a className="underline underline-offset-4" href="/contact">
                            contact form
                        </a>
                        .
                    </p>
                </div>

                <div className="text-white/50 text-sm">
                    Last updated: <time dateTime={updated}>{updated}</time>
                    <br />
                    <span>
            This page summarizes our current practices and is not legal advice.
          </span>
                </div>
            </div>
        </section>
    );
}
