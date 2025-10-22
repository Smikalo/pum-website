import { API_BASE } from "../../lib/config";
import Link from "next/link";

async function fetchProjects() {
  const res = await fetch(`${API_BASE}/api/projects`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

export default async function ProjectsPage() {
  const data = await fetchProjects();
  return (
    <section>
      <h1 className="text-3xl font-bold mb-4">Projects</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.items.map((p:any)=>(
          <Link key={p.slug} href={`/projects/${p.slug}`} className="card p-4 hover:shadow-xl transition">
            <div className="font-semibold">{p.title}</div>
            <div className="text-xs text-slate-400 mt-1">{(p.tags||[]).join(", ")}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
