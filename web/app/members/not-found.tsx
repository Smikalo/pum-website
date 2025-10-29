import Link from "next/link";

export default function NotFound() {
    return (
        <section className="container mx-auto px-4 py-12">
            <h1 className="mb-2 text-3xl font-semibold">Member not found</h1>
            <p className="text-white/70">
                The page you’re looking for doesn’t exist.{" "}
                <Link href="/members" className="underline">
                    Back to Members
                </Link>
            </p>
        </section>
    );
}
