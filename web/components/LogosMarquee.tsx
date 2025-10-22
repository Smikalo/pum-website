export default function LogosMarquee() {
    const items = ["Google", "Meta", "BMW", "Siemens", "Microsoft", "TUM", "SAP", "Open Source"];
    return (
        <section className="section border-y border-white/10 py-8">
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-white/50 text-sm tracking-wider">
                {items.map((t,i)=> <span key={i}>{t}</span>)}
            </div>
        </section>
    );
}
