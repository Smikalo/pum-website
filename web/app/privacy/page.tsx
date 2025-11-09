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
                We respect your privacy. This page explains what personal data we process on
                this website, for what purposes, and how you can exercise your rights. PUM is
                a small, private, non-commercial portfolio and project site run by a group of
                friends/students.
            </p>

            <div className="mt-8 grid gap-6 max-w-3xl">
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">1. Controller</h2>
                    <p className="text-white/80">
                        The controller responsible for processing personal data in connection
                        with this website within the meaning of the General Data Protection
                        Regulation (GDPR) is:
                    </p>
                    <p className="text-white/80 mt-3">
                        <strong>Mykhailo Kozyrev</strong>
                        <br />
                        c/o IP-Management #7654
                        <br />
                        Ludwig-Erhard-Straße 18
                        <br />
                        20459 Hamburg
                        <br />
                        Germany
                    </p>
                    <p className="text-white/80 mt-3">
                        The site is operated as a private, non-commercial project by a small
                        group of friends/students (not a registered association or company).
                        <br />
                        <br />
                        Email for privacy-related requests:{" "}
                        <a
                            className="underline underline-offset-4"
                            href="mailto:contact@the-pum.com"
                        >
                            contact@the-pum.com
                        </a>
                        .
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        2. What data we process &amp; why
                    </h2>
                    <ul className="list-disc pl-5 text-white/80 space-y-2">
                        <li>
                            <strong>Server log data:</strong> When you visit our website, our
                            hosting provider automatically processes technical data such as
                            your IP address, date and time of access, URL accessed, referrer
                            URL, and basic browser information. This is necessary to deliver
                            the website and to ensure stability and security (for example, to
                            detect misuse). Legal basis: our legitimate interests in running
                            a secure website (Art. 6(1)(f) GDPR).
                        </li>
                        <li>
                            <strong>Contact requests:</strong> If you contact us (for example
                            via email or the contact form), we process the information you
                            provide (such as name, email address, role and your message) in
                            order to handle your request. Legal basis: depending on the
                            context, this is either steps prior to entering into a contract
                            or answering your enquiry (Art. 6(1)(b) GDPR) or our legitimate
                            interests in responding to requests (Art. 6(1)(f) GDPR); where you
                            clearly consent, Art. 6(1)(a) GDPR.
                        </li>
                        <li>
                            <strong>Accounts, member profiles &amp; portfolio content:</strong>{" "}
                            If the site allows you to log in or create a member profile, we
                            process login data (for example, email and password), basic
                            profile information and optional content you choose to share
                            (such as profile photos, project descriptions, event
                            participation or uploaded documents/CVs). This is used to provide
                            the account and display your content on the site. Legal basis:
                            performance of a contract / user relationship (Art. 6(1)(b) GDPR)
                            and, for public profile visibility or optional details, your
                            consent (Art. 6(1)(a) GDPR).
                        </li>
                        <li>
                            <strong>Technical integrations &amp; maps:</strong> If we embed
                            maps or similar third-party services, the providers of those
                            services may receive technical data (such as IP address and
                            request details) when content is loaded. Legal basis: our
                            legitimate interests in providing a modern, informative website
                            (Art. 6(1)(f) GDPR); where required, we will ask for your consent
                            beforehand (Art. 6(1)(a) GDPR).
                        </li>
                        <li>
                            <strong>Preferences (theme &amp; language):</strong> We store
                            your chosen dark/light theme and language (English/German) in
                            your browser (for example, using local storage) so the website
                            remembers your preference on the same device. This does not
                            create a personal profile and is not used for tracking. Legal
                            basis: our legitimate interests in providing a user-friendly
                            website (Art. 6(1)(f) GDPR).
                        </li>
                    </ul>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        3. Cookies, local storage &amp; analytics
                    </h2>
                    <p className="text-white/80">
                        We try to run this website with as few cookies as possible:
                    </p>
                    <ul className="list-disc pl-5 text-white/80 space-y-2 mt-2">
                        <li>
                            We may use <strong>necessary cookies</strong> (for example, a
                            session cookie and CSRF protection) to keep you logged in to your
                            account and to protect forms. These are required for the site to
                            function securely.
                        </li>
                        <li>
                            We use <strong>local storage</strong> in your browser to remember
                            your chosen theme (dark/light) and interface language
                            (English/German). This information stays on your device unless
                            you clear it in your browser.
                        </li>
                        <li>
                            We currently <strong>do not use third-party analytics or
                            advertising trackers</strong> (such as Google Analytics or ad
                            networks) on this site. If this changes in the future, we will
                            update this policy and, where required, ask for your consent
                            before placing such cookies.
                        </li>
                    </ul>
                    <p className="text-white/60 text-sm mt-2">
                        You can control and delete cookies and local storage entries yourself
                        via your browser settings. However, the site or login may not work
                        correctly without technically necessary cookies.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        4. Recipients &amp; data transfers
                    </h2>
                    <p className="text-white/80">
                        We use external service providers to host this website and, where
                        applicable, to send emails or store files. These providers act as
                        data processors on our behalf and are contractually obliged to
                        handle personal data only according to our instructions and to
                        implement appropriate security measures.
                    </p>
                    <p className="text-white/80 mt-2">
                        In general we aim to use providers within the EU/EEA. If data is
                        transferred to countries outside the EU/EEA (for example because a
                        service provider is based there), this is done on the basis of
                        appropriate safeguards such as EU Standard Contractual Clauses, or on
                        the basis of your explicit consent where required by law.
                    </p>

                    <div className="mt-4">
                        <h3 className="font-semibold text-white mb-1 text-sm">
                            Impressum-Privatschutz (IP-Management)
                        </h3>
                        <p className="text-white/80 text-sm">
                            We use the services of{" "}
                            <strong>Impressum-Privatschutz GmbH</strong>, Ludwig-Erhard-Str.
                            18, 20459 Hamburg, for the management of postal mail sent to us.
                            This provider offers a secure and reliable postal address for our
                            project (for example, for the imprint, privacy policy,
                            withdrawal information and similar legal sections). This use is
                            based on our legitimate interest in protecting our private home
                            addresses while still being reachable as required by law (Art.
                            6(1)(f) GDPR).
                        </p>
                        <p className="text-white/80 text-sm mt-2">
                            We have concluded a data processing agreement with
                            Impressum-Privatschutz and implement the strict requirements of
                            the German data protection authorities when using this service.
                            Further information about data protection at Impressum-Privatschutz
                            GmbH can be found here:{" "}
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

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">5. Retention</h2>
                    <p className="text-white/80">
                        We keep personal data only for as long as necessary for the purposes
                        described above or as required by law:
                    </p>
                    <ul className="list-disc pl-5 text-white/80 space-y-2 mt-2">
                        <li>
                            Server log data is typically kept only for a short period (for
                            example, a few weeks) for security and troubleshooting, and then
                            deleted or anonymised.
                        </li>
                        <li>
                            Contact requests are kept as long as needed to handle your
                            enquiry and for any follow-up questions, and may be retained for
                            longer where legal retention periods apply.
                        </li>
                        <li>
                            Account and profile data is stored for as long as you have an
                            account on this site. If you delete your account or ask us to
                            delete it, we will remove or anonymise the associated data, unless
                            legal obligations require longer storage.
                        </li>
                        <li>
                            Preferences stored locally in your browser (theme/language) remain
                            there until you clear them via your browser settings.
                        </li>
                    </ul>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">6. Your rights</h2>
                    <p className="text-white/80">
                        Under the GDPR, you have the following rights with respect to your
                        personal data, subject to the conditions set out in the law:
                    </p>
                    <ul className="list-disc pl-5 text-white/80 space-y-1 mt-2">
                        <li>Right of access (Art. 15 GDPR)</li>
                        <li>Right to rectification (Art. 16 GDPR)</li>
                        <li>Right to erasure (Art. 17 GDPR)</li>
                        <li>Right to restriction of processing (Art. 18 GDPR)</li>
                        <li>Right to data portability (Art. 20 GDPR)</li>
                        <li>Right to object (Art. 21 GDPR)</li>
                        <li>
                            Right to withdraw consent at any time (Art. 7(3) GDPR), without
                            affecting the lawfulness of processing based on consent before
                            its withdrawal.
                        </li>
                    </ul>
                    <p className="text-white/80 mt-3">
                        You also have the right to lodge a complaint with a supervisory
                        authority, in particular in the EU member state of your habitual
                        residence, your place of work or the place of the alleged
                        infringement.
                    </p>
                    <p className="text-white/60 text-sm mt-2">
                        For example, in Bavaria the competent authority is the{" "}
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
                        For questions about this privacy policy or to exercise your rights,
                        please contact us via{" "}
                        <a
                            className="underline underline-offset-4"
                            href="mailto:contact@the-pum.com"
                        >
                            contact@the-pum.com
                        </a>{" "}
                        or use our{" "}
                        <a className="underline underline-offset-4" href="/contact">
                            contact form
                        </a>
                        . We will handle your request as soon as reasonably possible, bearing
                        in mind that this is a private side project.
                    </p>
                </div>

                <div className="text-white/50 text-sm">
                    Last updated: <time dateTime={updated}>{updated}</time>
                    <br />
                    <span>
                        This page summarises our current practices for a small private
                        project and is not legal advice.
                    </span>
                </div>
            </div>
        </section>
    );
}
