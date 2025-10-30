"use client";

import React from "react";
import AccountEditor from "@/components/AccountEditor";
import { useAuth } from "@/context/AuthProvider";

export default function AccountPage() {
    const { user } = useAuth();

    return (
        <div className="mx-auto max-w-6xl px-4 py-10">
            <h1 className="text-2xl font-bold mb-1">Your account</h1>
            <p className="text-white/70 mb-8">
                Edit your public member page — avatar, links, skills and a Markdown bio recruiters will see.
            </p>

            {user ? <AccountEditor /> : <p className="text-white/70">Please log in using the top-right menu.</p>}
        </div>
    );
}
