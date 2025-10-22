import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "PUM — Projects of United Minds",
  description: "A collective of TUM students building cool projects & startups.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-800">
          <nav className="container py-4 flex items-center gap-6">
            <Link href="/" className="text-xl font-bold">PUM</Link>
            <div className="flex gap-4 text-sm">
              <Link href="/members">Members</Link>
              <Link href="/projects">Projects</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </nav>
        </header>
        <main className="container py-8">{children}</main>
        <footer className="border-t border-slate-800 mt-12">
          <div className="container py-6 text-sm text-slate-400">
            © {new Date().getFullYear()} PUM — Projects of United Minds
          </div>
        </footer>
      </body>
    </html>
  );
}
