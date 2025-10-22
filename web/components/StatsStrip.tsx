export default function StatsStrip() {
    const stats = [
        { label: "Members", value: "50+" },
        { label: "Hackathons", value: "20+" },
        { label: "Awards", value: "🏆" },
        { label: "Repos", value: "300+" }
    ];
    return (
        <section className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map(s => (
                <div key={s.label} className="card p-5 text-center">
                    <div className="text-3xl font-extrabold">{s.value}</div>
                    <div className="text-xs text-white/60">{s.label}</div>
                </div>
            ))}
        </section>
    );
}
