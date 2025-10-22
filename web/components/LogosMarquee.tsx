export default function LogosMarquee() {
    const items = ["Google", "Meta", "BMW", "Siemens", "Microsoft", "TUM", "SAP", "Open Source"];
    return (
        <section className="mt-16 overflow-hidden border-y border-white/10 py-6">
            <div className="marquee">
                {[...items, ...items].map((t, i) => (
                    <span key={i} className="mx-4 text-white/50 text-sm tracking-wider">{t}</span>
                ))}
            </div>
        </section>
    );
}
