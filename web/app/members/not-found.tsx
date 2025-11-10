// app/members/[slug]/not-found.tsx
import Link from "next/link";
import { tServer } from "@/lib/i18n-server";

export default function NotFound() {
    return (
        <section className="container mx-auto px-4 py-12">
            <h1 className="mb-2 text-3xl font-semibold">
                {tServer("memberDetail.notFound.title")}
            </h1>
            <p className="text-white/70">
                {tServer("memberDetail.notFound.body")}{" "}
                <Link href="/members" className="underline">
                    {tServer("memberDetail.notFound.back")}
                </Link>
            </p>
        </section>
    );
}
