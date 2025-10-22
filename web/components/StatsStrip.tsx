export default function StatsStrip() {
    const stats = [
        { label: "Members", value: "50+" },
        { label: "Hackathons", value: "20+" },
        { label: "Awards", value: "🏆" },
        { label: "Repos", value: "300+" },
    ];
    return (
        <section className="section">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.map(s => (
                    <div key={s.label} className="card p-6 text-center">
                        <div className="text-4xl md:text-5xl font-extrabold">{s.value}</div>
                        <div className="mt-1 text-xs text-white/60 uppercase tracking-wider">{s.label}</div>
                    </div>
                ))}
            </div>
        </section>
    );
}
