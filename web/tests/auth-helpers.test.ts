import { getRoles } from "@/lib/auth-helpers";

describe("getRoles", () => {
    it("returns empty array for null/undefined user", () => {
        expect(getRoles(null)).toEqual([]);
        expect(getRoles(undefined)).toEqual([]);
        expect(getRoles({})).toEqual([]);
    });

    it("returns roles from user.roles", () => {
        expect(getRoles({ roles: ["ADMIN", "MEMBER"] })).toEqual(["ADMIN", "MEMBER"]);
    });

    it("returns roles from user.roleNames (fallback)", () => {
        expect(getRoles({ roleNames: ["MODERATOR"] })).toEqual(["MODERATOR"]);
    });

    it("prefers roles over roleNames", () => {
        expect(
            getRoles({ roles: ["A"], roleNames: ["B"] })
        ).toEqual(["A"]);
    });
});