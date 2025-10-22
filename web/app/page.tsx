export default function Home() {
  return (
    <section className="grid md:grid-cols-2 gap-8 items-center">
      <div>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
          PUM — Projects of United Minds
        </h1>
        <p className="mt-4 text-slate-300">
          We’re a group of ~50 initiative TUM students hacking at 20+ hackathons and building startups.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <div className="text-3xl font-bold">50+</div>
            <div className="text-xs text-slate-400">Members</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-3xl font-bold">20+</div>
            <div className="text-xs text-slate-400">Hackathons</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-3xl font-bold">∞</div>
            <div className="text-xs text-slate-400">Ideas</div>
          </div>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-semibold mb-2">What we do</h3>
        <p className="text-sm text-slate-300">
          Projects, startups and fun. Browse members and projects or get in touch.
        </p>
      </div>
    </section>
  );
}
