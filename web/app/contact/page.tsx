"use client";
import { useState } from "react";

export default function ContactPage(){
  const [status,setStatus] = useState<string|undefined>();
  async function onSubmit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      type: (form.elements.namedItem("type") as HTMLSelectElement).value,
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };
    const res = await fetch("/api/contact", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { setStatus("Failed"); return; }
    setStatus("Thanks! We’ll get back to you.");
    form.reset();
  }
  return (
    <section className="max-w-xl">
      <h1 className="text-3xl font-bold mb-4">Contact us</h1>
      <form onSubmit={onSubmit} className="card p-5 space-y-3">
        <select name="type" className="bg-slate-800 rounded px-3 py-2 w-full" defaultValue="RECRUITER">
          <option value="RECRUITER">Recruiter</option>
          <option value="NEW_MEMBER">New member</option>
          <option value="SPONSOR">Sponsor/Partner</option>
          <option value="OTHER">Other</option>
        </select>
        <input name="name" placeholder="Your name" required className="bg-slate-800 rounded px-3 py-2 w-full" />
        <input name="email" placeholder="Your email" required type="email" className="bg-slate-800 rounded px-3 py-2 w-full" />
        <textarea name="message" placeholder="Message" required className="bg-slate-800 rounded px-3 py-2 w-full min-h-32" />
        <button className="bg-sky-500 hover:bg-sky-600 rounded px-4 py-2 font-semibold">Send</button>
        {status && <p className="text-sm text-slate-300">{status}</p>}
      </form>
    </section>
  );
}
