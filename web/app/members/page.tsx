import { API_BASE } from "../../lib/config";
import Link from "next/link";

async function fetchMembers(q?: string) {
  const url = new URL("/api/members", API_BASE);
  if (q) url.searchParams.set("q", q);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load members");
  return res.json();
}

export default async function MembersPage() {
  const data = await fetchMembers();
  return (
    <section>
      <h1 className="text-3xl font-bold mb-4">Members</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.items.map((m:any)=>(
          <Link key={m.slug} href={`/members/${m.slug}`} className="card p-4 hover:shadow-xl transition">
            <div className="font-semibold">{m.name}</div>
            <div className="text-xs text-slate-400 mt-1">{(m.skills||[]).join(", ")}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
