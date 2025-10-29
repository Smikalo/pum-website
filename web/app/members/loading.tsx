export default function Loading() {
    return (
        <section className="container mx-auto px-4 py-8">
            <div className="mb-6 h-8 w-40 rounded bg-white/10" />
            <div className="mb-6 h-10 w-full rounded bg-white/5" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-40 rounded-2xl border border-white/10" />
                ))}
            </div>
        </section>
    );
}
