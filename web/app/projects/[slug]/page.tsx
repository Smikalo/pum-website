import { API_BASE } from "../../../lib/config";

async function getProject(slug:string){
  const res = await fetch(`${API_BASE}/api/projects/${slug}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Project not found");
  return res.json();
}

export default async function ProjectDetail({ params }: { params: { slug: string } }) {
  const p = await getProject(params.slug);
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-bold">{p.title}</h1>
      <p className="text-slate-300">{p.summary}</p>
      <div className="text-sm"><b>Tech:</b> {(p.techStack||[]).join(", ")}</div>
      <section>
        <h2 className="font-semibold mb-2">Members</h2>
        <ul className="grid sm:grid-cols-2 gap-3">
          {p.members.map((r:any)=>(
            <li key={r.member.slug} className="card p-3">
              <div className="font-semibold">{r.member.name}</div>
              <div className="text-xs text-slate-400">{r.role}</div>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
