import "./globals.css";
import { Inter } from "next/font/google";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata = {
  title: "PUM — Projects of United Minds",
  description: "TUM makers shipping secure, fast products and research demos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur supports-backdrop-blur:bg-black/60">
        <div className="mx-auto max-w-7xl px-4 md:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="font-black tracking-widest text-lg">PUM</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
            <Link href="/projects" className="hover:text-white">Projects</Link>
            <Link href="/members" className="hover:text-white">Members</Link>
            <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 hover:bg-white hover:text-black transition-colors">
              Contact
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 md:px-8">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 md:px-8 py-16 text-sm text-white/50">
        <div className="border-t border-white/10 pt-8">© {new Date().getFullYear()} PUM — Projects of United Minds</div>
      </footer>
      </body>
      </html>
  );
}
