import { API_BASE } from "../../../lib/config";

async function getMember(slug:string){
  const res = await fetch(`${API_BASE}/api/members/${slug}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Member not found");
  return res.json();
}

export default async function MemberDetail({ params }: { params: { slug: string } }) {
  const m = await getMember(params.slug);
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-bold">{m.name}</h1>
      <p className="text-slate-300">{m.shortBio}</p>
      <section>
        <h2 className="font-semibold mb-2">Projects</h2>
        <ul className="grid sm:grid-cols-2 gap-3">
          {m.projects.map((p:any)=>(
            <li key={p.slug} className="card p-4">
              <div className="font-semibold">{p.title}</div>
              <div className="text-xs text-slate-400">{(p.techStack||[]).join(", ")}</div>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
