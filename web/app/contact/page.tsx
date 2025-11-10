import React from "react";
import { API_BASE } from "@/lib/config";
import ContactForm from "@/components/ContactForm";
import type { ContactState } from "@/types/contact";
import { tServer } from "@/lib/i18n-server";

// Server Action — keep it in this Server Component file, but DO NOT export it.
async function submitContact(
    prev: ContactState,
    formData: FormData,
): Promise<ContactState> {
  "use server";

  const data = {
    name:
        (formData.get("name") as string | null)
            ?.toString()
            .trim() || "",
    email:
        (formData.get("email") as string | null)
            ?.toString()
            .trim() || "",
    role:
        (formData.get("role") as string | null)
            ?.toString()
            .trim() || "",
    topic:
        (formData.get("topic") as string | null)
            ?.toString()
            .trim() || "",
    message:
        (formData.get("message") as string | null)
            ?.toString()
            .trim() || "",
    subscribe: formData.get("subscribe") === "on",
    website:
        (formData.get("website") as string | null)
            ?.toString()
            .trim() || "",
  };

  const errors: ContactState["errors"] = {};
  if (!data.name)
    errors.name = tServer("contact.form.error.name");
  if (
      !data.email ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)
  )
    errors.email = tServer("contact.form.error.email");
  if (!data.role)
    errors.role = tServer("contact.form.error.role");
  if (!data.topic)
    errors.topic = tServer("contact.form.error.topic");
  if (!data.message || data.message.length < 10)
    errors.message = tServer("contact.form.error.message");

  if (data.website) {
    return {
      ok: true,
      message: tServer("contact.form.success.generic"),
    };
  }

  if (Object.keys(errors).length) {
    return {
      ok: false,
      errors,
      fields: data,
      message: tServer("contact.form.error.fixFields"),
    };
  }

  let apiMessage = tServer("contact.form.success.generic");
  let ok = true;

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

    if (!res.ok) {
      ok = true;
    } else {
      const json = (await res.json().catch(() => null)) as
          | {
        message?: string;
        newsletterStatus?: string | null;
      }
          | null;

      if (
          json?.message &&
          typeof json.message === "string"
      ) {
        apiMessage = json.message;
      }
    }
  } catch {
    ok = true;
  }

  return {
    ok,
    message: apiMessage,
  };
}

export default function ContactPage() {
  return (
      <section className="section">
        <header className="mb-6">
          <p className="kicker">
            {tServer("contact.kicker")}
          </p>
          <h1 className="display">
            {tServer("contact.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-white/70">
            {tServer("contact.subtitle")}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ContactForm action={submitContact} />
            <p className="mt-3 text-xs text-white/50">
              {tServer("contact.form.footer")}
            </p>
          </div>

          <aside className="lg:col-span-2">
            <div className="card space-y-4 p-5">
              <h2 className="text-lg font-semibold">
                {tServer("contact.side.title")}
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-white/70">
                <li>
                  {tServer(
                      "contact.side.item1",
                  )}
                </li>
                <li>
                  {tServer(
                      "contact.side.item2",
                  )}
                </li>
                <li>
                  {tServer(
                      "contact.side.item3",
                  )}
                </li>
              </ul>
              <div className="pt-2 text-sm text-white/60">
                {tServer("contact.side.emailLabel")}{" "}
                <span className="text-white">
                                <a
                                    className="underline underline-offset-4"
                                    href="mailto:contact@the-pum.de"
                                >
                                    contact@the-pum.de
                                </a>
                            </span>
              </div>
            </div>
          </aside>
        </div>
      </section>
  );
}
