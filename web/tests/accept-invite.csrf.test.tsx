import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
// Mock next/navigation
jest.mock("next/navigation", () => ({
    useRouter: () => ({ replace: jest.fn() }),
    useSearchParams: () => ({ get: (key: string) => (key === "token" ? "inv-token" : null) }),
}));
// Mock csrf lib
jest.mock("@/lib/csrf", () => ({
    getCsrfToken: jest.fn(),
}));

// Mock I18nProvider
jest.mock("@/context/I18nProvider", () => ({
    useI18n: () => ({ t: (key: string) => key }),
}));

import AcceptInvitePage from "../app/accept-invite/page";
import { getCsrfToken } from "@/lib/csrf";

// Mock fetch
global.fetch = jest.fn();

describe("AcceptInvitePage CSRF", () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
        (getCsrfToken as jest.Mock).mockResolvedValue("mock-csrf-token");
    });

    it("uses getCsrfToken and includes header on submit", async () => {
        // Mock initial validation call
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ok: false,
                needsPassword: true,
                email: "test@example.com",
            }),
        });

        render(<AcceptInvitePage />);

        // Wait for form
        await waitFor(() => expect(screen.getByText(/acceptInvite.create.title/i)).toBeInTheDocument());

        expect(getCsrfToken).toHaveBeenCalled();

        // Submit form
        // The inputs use t() keys as labels in the mocked provider
        const nameInput = screen.getByText(/acceptInvite.form.fullName.label/i).nextElementSibling as HTMLInputElement;
        const passInput = screen.getByText(/^acceptInvite.form.password.label$/i).nextElementSibling as HTMLInputElement;
        const repeatInput = screen.getByText(/acceptInvite.form.passwordRepeat.label/i).nextElementSibling as HTMLInputElement;
        const submitBtn = screen.getByRole("button", { name: /acceptInvite.form.submit.default/i });

        fireEvent.change(nameInput, { target: { value: "Test User" } });
        fireEvent.change(passInput, { target: { value: "password123" } });
        fireEvent.change(repeatInput, { target: { value: "password123" } });

        // Mock submit response
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ok: true }),
        });

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("/api/auth/invite/consume"),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "X-CSRF-Token": "mock-csrf-token",
                    }),
                })
            );
        });
    });
});