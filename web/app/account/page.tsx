'use client';

import React from "react";
import { useAuth } from "@/context/AuthProvider";
import Link from "next/link";

export default function AccountPage() {
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-12">
                <h1 className="text-2xl font-bold mb-2">Your account</h1>
                <p className="text-white/70">Please log in using the top-right menu to access your profile.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl px-4 py-12">
            <h1 className="text-2xl font-bold mb-2">Welcome{user.member?.name ? `, ${user.member.name}` : ""}!</h1>
            <p className="text-white/70">This is the start of your personal profile area. We’ll add editing and CV upload in the next phase.</p>
            {user.member?.slug && (
                <p className="mt-4">
                    Public profile:{" "}
                    <Link className="underline" href={`/members/${user.member.slug}`}>/members/{user.member.slug}</Link>
                </p>
            )}
        </div>
    );
}
