import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Imprint – PUM",
    description:
        "Legal notice (Impressum) with provider identification and contact details for this private portfolio website.",
};

export default function ImprintPage() {
    return (
        <section className="section py-10">
            <p className="kicker">LEGAL</p>
            <h1 className="display">Imprint (Impressum)</h1>
            <p className="mt-3 text-white/70 max-w-2xl">
                Provider identification and basic legal information for this personal,
                non-commercial portfolio and project website operated by a small group of
                friends/students. We are not a registered association or company and this is
                not an official website of the Technical University of Munich (TUM).
            </p>

            <div className="mt-8 grid gap-6 max-w-3xl">
                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Inhalte gemäß § 5 DDG</h2>
                    <p className="text-white/80">
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
                    <p className="text-white/80 mt-4">
                        This website (&quot;Project of United Minds&quot; / &quot;PUM&quot;)
                        is run as a private, non-commercial project by a small group of
                        friends/students to present ourselves and our projects (for example,
                        to potential collaborators or employers). The person named above acts
                        as the service provider ({'"'}Diensteanbieter{'"'}) for this website
                        in the sense of German law.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Contact</h2>
                    <p className="text-white/80">
                        E-Mail:{" "}
                        <a
                            href="mailto:contact@the-pum.com"
                            className="underline underline-offset-4"
                        >
                            contact@the-pum.com
                        </a>
                        <br />
                        Telefon:{" "}
                        <a
                            href="tel:+4917636089141"
                            className="underline underline-offset-4"
                        >
                            +49&nbsp;176&nbsp;36089141
                        </a>
                        <br />
                        Web:{" "}
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
                        Legal form / representation
                    </h2>
                    <p className="text-white/80">
                        PUM is not a registered association, company or other legal entity.
                        There is no separate board or managing director. The natural person
                        named above acts as contact and is responsible for this website on
                        behalf of the group of contributors.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Register / VAT</h2>
                    <p className="text-white/80">
                        PUM is a private, non-commercial project. There is currently no entry
                        in a commercial, association or cooperative register, and no
                        Umsatzsteuer-Identifikationsnummer (VAT ID) or Wirtschafts-ID for
                        this website operator. If this changes in the future, this section
                        will be updated accordingly.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">
                        Editorial responsibility
                    </h2>
                    <p className="text-white/80">
                        Responsible for content according to §&nbsp;18 MStV:
                        <br />
                        <strong>Mykhailo Kozyrev</strong>
                        <br />
                        c/o IP-Management #7654
                        <br />
                        Ludwig-Erhard-Str. 18
                        <br />
                        20459 Hamburg
                        <br />
                        Germany
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Liability</h2>
                    <p className="text-white/80">
                        We carefully check the content of this website. Nevertheless, we
                        assume no liability for completeness, correctness or up-to-dateness.
                        We also have no control over the content of external websites linked
                        from this site and therefore cannot accept any responsibility for
                        them; the respective providers or operators are solely responsible
                        for their content.
                    </p>
                </div>

                <div className="card p-5">
                    <h2 className="text-lg font-semibold mb-2">Copyright</h2>
                    <p className="text-white/80">
                        Texts, photos, graphics and other media on this site are protected by
                        copyright. Please obtain permission from us before reusing any
                        materials, unless a different licence is explicitly indicated. Where
                        third-party content is used, it is credited accordingly as far as
                        possible.
                    </p>
                </div>

                <div className="text-white/50 text-sm">
                    This imprint is provided on a best-effort basis for a small private
                    project and does not replace tailored legal advice.
                    <br />
                    <span className="text-white/40">
                        Source: Impressum generated with Impressum-Privatschutz
                        (&quot;Impressum-Privatschutz GmbH&quot;).
                    </span>
                </div>
            </div>
        </section>
    );
}
