// api/tests/uploads.service.unit.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// --- Mock DB ---
const mockPrisma = {
    skill: { findMany: async () => [] },
    tech: { findMany: async () => [] },
    member: {
        findUnique: async () => ({ links: {}, avatarUrl: null }),
        update: async () => {}
    }
};

jest.mock('../src/db', () => ({ prisma: mockPrisma }));

const {
    processCvUpload,
    processAvatarUpload,
    processImageUpload,
    looksLikePdf,
    UPLOAD_RULES
} = require('../src/services/uploads.service');
const { BadRequestError } = require('../src/errors');

function createTempFile(content, name, type = "application/pdf") {
    const p = path.join(__dirname, name || `temp-${Date.now()}.tmp`);
    fs.writeFileSync(p, content);
    return {
        path: p,
        size: Buffer.byteLength(content),
        mimetype: type,
        originalname: name,
        filename: name
    };
}

const userId = "u1";
const memberId = "m1";
let createdFiles = [];

// Register file for cleanup
function track(f) {
    createdFiles.push(f.path);
    return f;
}

describe("Uploads Service", () => {
    afterEach(() => {
        for (const p of createdFiles) {
            try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
        }
        createdFiles = [];
        const latest = path.join(__dirname, `../../uploads/cv/${userId}-latest.pdf`);
        try { if (fs.existsSync(latest)) fs.unlinkSync(latest); } catch {}
    });

    test('looksLikePdf detects PDF header (async)', async () => {
        const pdf = track(createTempFile("%PDF-1.4 content", "test.pdf", "application/pdf"));
        await expect(looksLikePdf(pdf.path)).resolves.toBe(true);

        const txt = track(createTempFile("NOTPDF", "fake.pdf", "application/pdf"));
        await expect(looksLikePdf(txt.path)).resolves.toBe(false);
    });

    test('processCvUpload validates MIME', async () => {
        const f = track(createTempFile("doc", "test.doc", "application/msword"));
        await expect(processCvUpload({ userId, memberId, file: f }))
            .rejects.toThrow(UPLOAD_RULES.cv.errorMsg);
    });

    test('processCvUpload validates content signature', async () => {
        const f = track(createTempFile("fake", "bad.pdf", "application/pdf"));
        await expect(processCvUpload({ userId, memberId, file: f }))
            .rejects.toThrow("Invalid PDF file");
    });

    test('processCvUpload succeeds for valid PDF', async () => {
        const f = track(createTempFile("%PDF-1.5 data", "good.pdf", "application/pdf"));
        const res = await processCvUpload({ userId, memberId, file: f });
        expect(res.url).toContain(`${userId}-latest.pdf`);
    });

    test('processAvatarUpload validates MIME', async () => {
        const f = track(createTempFile("<svg>", "test.svg", "image/svg+xml"));
        await expect(processAvatarUpload({ userId, memberId, file: f }))
            .rejects.toThrow(UPLOAD_RULES.avatar.errorMsg);
    });

    test('processAvatarUpload succeeds for valid PNG', async () => {
        const f = track(createTempFile("imgdata", "test.png", "image/png"));
        const res = await processAvatarUpload({ userId, memberId, file: f });
        expect(res.url).toContain("test.png");
    });

    test('processImageUpload succeeds', async () => {
        const f = track(createTempFile("img", "blog.jpg", "image/jpeg"));
        const res = await processImageUpload({ file: f, subDir: "blogs" });
        expect(res.url).toBe("/uploads/blogs/blog.jpg");
    });
});