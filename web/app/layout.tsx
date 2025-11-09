// web/app/layout.tsx
import "./globals.css";
import "./containers.css";
import "./nav-animations.css"; // navbar animations
import "./color-images.css"; // keep uploaded pictures/avatars in full color

import React from "react";
import type { Metadata } from "next";

import NavBar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/context/AuthProvider";
import { I18nProvider } from "@/context/I18nProvider";

export const metadata: Metadata = {
    title: "PUM",
    description: "Project of United Minds",
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
        <body className="antialiased bg-black text-white">
        <AuthProvider>
            <I18nProvider>
                <NavBar />
                <main className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black">
                    {children}
                </main>
                <Footer />
            </I18nProvider>
        </AuthProvider>
        </body>
        </html>
    );
}
