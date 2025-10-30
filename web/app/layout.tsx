import "./globals.css";
import "./containers.css";
import "./nav-animations.css"; // ← add animations

import React from "react";
import type { Metadata } from "next";

import NavBar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/context/AuthProvider";

export const metadata: Metadata = {
    title: "PUM",
    description: "Project of United Minds",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="bg-black">
        <body className="text-white antialiased">
        <AuthProvider>
            <NavBar />
            <main>{children}</main>
            <Footer />
        </AuthProvider>
        </body>
        </html>
    );
}
