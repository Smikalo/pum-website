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
                <div key={stats[0].label} className="card p-6 text-center">
                    <div className="text-4xl md:text-5xl font-extrabold">{stats[0].value}</div>
                    <div className="mt-1 text-xs text-white/60 uppercase tracking-wider">{stats[0].label}</div>
                </div>
                <div key={stats[1].label} className="card p-6 text-center">
                    <div className="text-4xl md:text-5xl font-extrabold">{stats[1].value}</div>
                    <div className="mt-1 text-xs text-white/60 uppercase tracking-wider">{stats[1].label}</div>
                </div>
                <div key={stats[2].label} className="card p-6 text-center">
                    <div className="text-4xl md:text-5xl font-extrabold emoji-stable">{stats[2].value}</div>
                    <div className="mt-1 text-xs text-white/60 uppercase tracking-wider">{stats[2].label}</div>
                </div>
                <div key={stats[3].label} className="card p-6 text-center">
                    <div className="text-4xl md:text-5xl font-extrabold">{stats[3].value}</div>
                    <div className="mt-1 text-xs text-white/60 uppercase tracking-wider">{stats[3].label}</div>
                </div>
            </div>
        </section>
    );
}
