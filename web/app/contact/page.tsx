import React from "react";
import { API_BASE } from "@/lib/config";
import ContactForm from "@/components/ContactForm";
import type { ContactState } from "@/types/contact";

// Server Action — keep it in this Server Component file, but DO NOT export it.
async function submitContact(prev: ContactState, formData: FormData): Promise<ContactState> {
  "use server";

  const data = {
    name: (formData.get("name") as string | null)?.toString().trim() || "",
    email: (formData.get("email") as string | null)?.toString().trim() || "",
    role: (formData.get("role") as string | null)?.toString().trim() || "",
    topic: (formData.get("topic") as string | null)?.toString().trim() || "",
    message: (formData.get("message") as string | null)?.toString().trim() || "",
    subscribe: formData.get("subscribe") === "on",
    // honeypot
    website: (formData.get("website") as string | null)?.toString().trim() || "",
  };

  const errors: ContactState["errors"] = {};
  if (!data.name) errors.name = "Please tell us your name.";
  if (!data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) errors.email = "Enter a valid email address.";
  if (!data.role) errors.role = "Select who you are.";
  if (!data.topic) errors.topic = "Select what you’re interested in.";
  if (!data.message || data.message.length < 10) errors.message = "Tell us a bit more (10+ characters).";

  // If honeypot is filled, silently accept (anti-spam).
  if (data.website) {
    return { ok: true, message: "Thanks! We’ll be in touch soon." };
  }

  if (Object.keys(errors).length) {
    return { ok: false, errors, fields: data, message: "Please fix the highlighted fields." };
  }

  // Try to forward to your backend; succeed gracefully if not present yet.
  try {
    const res = await fetch(`${API_BASE}/api/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        role: data.role,
        topic: data.topic,
        message: data.message,
        subscribe: data.subscribe,
        source: "pum-web",
      }),
      cache: "no-store",
    });
    if (!res.ok) console.error("Contact API returned non-OK:", res.status);
  } catch (err) {
    console.warn("Contact API not reachable; storing client-only.", err);
  }

  return { ok: true, message: "Thanks! We’ll be in touch soon." };
}

export default function ContactPage() {
  return (
      <section className="section">
        <header className="mb-6">
          <p className="kicker">CONTACT</p>
          <h1 className="display">Let’s build something together</h1>
          <p className="mt-3 text-white/70 max-w-2xl">
            Recruiters, new members, sponsors & clients — drop us a line. Tell us who you are and what
            you have in mind. We’ll reply quickly.
          </p>
        </header>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            {/* Pass the server action to the client form */}
            <ContactForm action={submitContact} />
            <p className="text-white/50 text-xs mt-3">
              We validate on the server and announce status with an ARIA live region for accessibility.
            </p>
          </div>

          <aside className="lg:col-span-2">
            <div className="card p-5 space-y-4">
              <h2 className="text-lg font-semibold">Why reach out?</h2>
              <ul className="list-disc pl-5 text-white/70 space-y-1">
                <li>Hire from a proven pool of builders (hackathons, startups).</li>
                <li>Co-create a PoC or MVP with our specialized teams.</li>
                <li>Join PUM and ship with us — ML/AI, full-stack, design, business.</li>
              </ul>
              <div className="pt-2 text-sm text-white/60">
                Prefer email? <span className="text-white">contact@the-pum.com</span>
              </div>
            </div>
          </aside>
        </div>
      </section>
  );
}
