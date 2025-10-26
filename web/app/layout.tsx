import "./globals.css";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
    title: "PUM — Project of United Minds",
    description: "A collective of initiative TUM students building cool projects.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="h-full">
        <body className="min-h-full bg-gradient-to-b from-neutral-950 to-neutral-900 text-white">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
        </main>
        </body>
        </html>
    );
}
