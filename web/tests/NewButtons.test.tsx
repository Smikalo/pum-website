import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import NewProjectButton from "../components/NewProjectButton";
import NewEventButton from "../components/NewEventButton";
import NewBlogButton from "../components/NewBlogButton";

// Mock auth helpers
jest.mock("@/lib/auth-helpers", () => ({
    useSafeAuth: jest.fn(),
    getRoles: jest.fn(),
}));
import { useSafeAuth, getRoles } from "@/lib/auth-helpers";

describe("New* Buttons", () => {
    beforeEach(() => {
        (getRoles as jest.Mock).mockImplementation((user) => user?.roles || []);
    });

    test("NewProjectButton hidden when logged out", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: null });
        render(<NewProjectButton />);
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    test("NewProjectButton visible when logged in", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: { id: "u1", roles: [] } });
        render(<NewProjectButton />);
        expect(screen.getByRole("link")).toBeInTheDocument();
    });

    test("NewEventButton hidden when logged out", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: null });
        render(<NewEventButton />);
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    test("NewEventButton visible when logged in", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: { id: "u1" } });
        render(<NewEventButton />);
        expect(screen.getByRole("link")).toBeInTheDocument();
    });

    test("NewBlogButton hidden when logged out", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: null });
        render(<NewBlogButton />);
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    test("NewBlogButton visible when logged in", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: { id: "u1" } });
        render(<NewBlogButton />);
        expect(screen.getByRole("link")).toBeInTheDocument();
    });
});