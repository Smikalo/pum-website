"use client";

import React from "react";
import AccountEditor from "@/components/AccountEditor";
import { useAuth } from "@/context/AuthProvider";
import { useI18n } from "@/context/I18nProvider";

export default function AccountPage() {
    const { user } = useAuth();
    const { t } = useI18n();

    return (
        <div className="mx-auto max-w-6xl px-4 py-10">
            <h1 className="mb-1 text-2xl font-bold">
                {t("account.title")}
            </h1>
            <p className="mb-8 text-white/70">
                {t("account.intro")}
            </p>

            {user ? (
                <AccountEditor />
            ) : (
                <p className="text-white/70">
                    {t("account.loginPrompt")}
                </p>
            )}
        </div>
    );
}
