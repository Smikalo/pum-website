import { tServer } from "@/lib/i18n-server";

export default function StatsStrip() {
    const stats = [
        {
            label: tServer("statsStrip.members.label"),
            value: tServer("statsStrip.members.value"),
        },
        {
            label: tServer("statsStrip.hackathons.label"),
            value: tServer("statsStrip.hackathons.value"),
        },
        {
            label: tServer("statsStrip.awards.label"),
            value: tServer("statsStrip.awards.value"),
        },
        {
            label: tServer("statsStrip.repos.label"),
            value: tServer("statsStrip.repos.value"),
        },
    ];
    return (
        <section className="section">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.map((stat) => (
                    <div key={stat.label} className="card p-6 text-center">
                        <div className="text-4xl md:text-5xl font-extrabold emoji-stable">
                            {stat.value}
                        </div>
                        <div className="mt-1 text-xs text-white/60 uppercase tracking-wider">
                            {stat.label}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
