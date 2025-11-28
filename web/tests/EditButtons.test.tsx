import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import EditProjectButton from "../components/EditProjectButton";
import EditEventButton from "../components/EditEventButton";
import EditMemberButton from "../components/EditMemberButton";

// Mock auth helpers
jest.mock("@/lib/auth-helpers", () => ({
    useSafeAuth: jest.fn(),
    getRoles: jest.fn(),
}));
import { useSafeAuth, getRoles } from "@/lib/auth-helpers";

describe("Edit* Buttons", () => {
    beforeEach(() => {
        (getRoles as jest.Mock).mockImplementation((user) => user?.roles || []);
    });

    // Project
    test("EditProjectButton hidden if not creator/admin/mod", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: { roles: [] } });
        render(<EditProjectButton slug="p1" creatorSlug="other" />);
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    test("EditProjectButton visible if creator", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({
            user: { roles: [], member: { slug: "me" } }
        });
        render(<EditProjectButton slug="p1" creatorSlug="me" />);
        expect(screen.getByRole("link")).toBeInTheDocument();
    });

    test("EditProjectButton visible if admin", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: { roles: ["ADMIN"] } });
        render(<EditProjectButton slug="p1" creatorSlug="other" />);
        expect(screen.getByRole("link")).toBeInTheDocument();
    });

    // Event
    test("EditEventButton visible if mod", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: { roles: ["MODERATOR"] } });
        render(<EditEventButton slug="e1" creatorSlug="other" />);
        expect(screen.getByRole("link")).toBeInTheDocument();
    });

    // Member
    test("EditMemberButton hidden if not admin/mod", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: { roles: ["MEMBER"] } });
        render(<EditMemberButton slug="m1" />);
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    test("EditMemberButton visible if admin", () => {
        (useSafeAuth as jest.Mock).mockReturnValue({ user: { roles: ["ADMIN"] } });
        render(<EditMemberButton slug="m1" />);
        expect(screen.getByRole("button")).toBeInTheDocument();
    });
});