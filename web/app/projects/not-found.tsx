// web/app/projects/not-found.tsx
import Link from "next/link";
import { tServer } from "@/lib/i18n-server";

export default function NotFound() {
    return (
        <section className="container mx-auto px-4 py-12">
            <h1 className="mb-2 text-3xl font-semibold">
                {tServer("projectDetail.notFound.title")}
            </h1>
            <p className="text-white/70">
                {tServer("projectDetail.notFound.body")}{" "}
                <Link href="/projects" className="underline">
                    {tServer("projectDetail.notFound.back")}
                </Link>
            </p>
        </section>
    );
}
