import { getCsrfToken } from "@/lib/csrf";

// Mock fetch globally
global.fetch = jest.fn();

describe("getCsrfToken", () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
        // Reset document.cookie
        Object.defineProperty(document, "cookie", {
            writable: true,
            value: "",
        });
    });

    it("fetches endpoint and returns cookie value", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({}),
        });

        // Simulate cookie set by backend
        document.cookie = "XSRF-TOKEN=test-token-123; Path=/";

        const token = await getCsrfToken();

        expect(token).toBe("test-token-123");
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/auth/csrf"),
            expect.objectContaining({
                method: "GET",
                credentials: "include",
            })
        );
    });

    it("throws if fetch fails", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 500,
        });

        await expect(getCsrfToken()).rejects.toThrow("Failed to fetch CSRF token");
    });
});