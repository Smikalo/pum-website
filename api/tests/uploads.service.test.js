// api/tests/uploads.service.test.js
const { processCvUpload, looksLikePdf } = require("../src/services/uploads.service");
const fs = require("fs");
const path = require("path");

// Mock prisma
jest.mock("../src/db", () => ({
    prisma: {
        member: { findUnique: jest.fn(), update: jest.fn() },
        skill: { findMany: jest.fn(() => Promise.resolve([])) },
        tech: { findMany: jest.fn(() => Promise.resolve([])) }
    }
}));

// Helper to create dummy file
function createTempFile(content, name) {
    const p = path.join(__dirname, name || "temp.tmp");
    fs.writeFileSync(p, content);
    return p;
}

describe("uploads.service", () => {
    const userId = "u1";
    const memberId = "m1";
    let tmpFile;

    afterEach(() => {
        if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        const latest = path.join(__dirname, "../../uploads/cv/u1-latest.pdf");
        if (fs.existsSync(latest)) fs.unlinkSync(latest);
    });

    test("looksLikePdf returns true for %PDF- header", () => {
        tmpFile = createTempFile("%PDF-1.4 content");
        expect(looksLikePdf(tmpFile)).toBe(true);
    });

    test("looksLikePdf returns false for garbage", () => {
        tmpFile = createTempFile("NOTPDF");
        expect(looksLikePdf(tmpFile)).toBe(false);
    });

    test("processCvUpload throws if not PDF", async () => {
        tmpFile = createTempFile("fake content");
        const file = { path: tmpFile };
        await expect(processCvUpload({ userId, memberId, file })).rejects.toThrow("Invalid PDF file");
    });
});