// api/tests/uploads.service.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mockPrisma = {
    skill: { findMany: async () => [] },
    tech: { findMany: async () => [] },
    member: {
        findUnique: async () => ({ links: {}, avatarUrl: null }),
        update: async () => {}
    }
};

const dbPath = require.resolve('../src/db');
require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { prisma: mockPrisma }
};

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

function cleanup() {
    for (const f of createdFiles) {
        try { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch {}
    }
    createdFiles = [];
    const latest = path.join(__dirname, `../../uploads/cv/${userId}-latest.pdf`);
    try { if (fs.existsSync(latest)) fs.unlinkSync(latest); } catch {}
}

async function runTests() {
    console.log("Running uploads.service.test.js");

    // Test 1
    {
        const f = createTempFile("%PDF-1.4 content", "test.pdf", "application/pdf");
        createdFiles.push(f);
        assert.strictEqual(looksLikePdf(f.path), true, "looksLikePdf true for PDF");

        const f2 = createTempFile("NOTPDF", "fake.pdf", "application/pdf");
        createdFiles.push(f2);
        assert.strictEqual(looksLikePdf(f2.path), false, "looksLikePdf false for non-PDF");
    }

    // Test 2: CV validations
    {
        const f = createTempFile("doc content", "test.doc", "application/msword");
        createdFiles.push(f);
        await assert.rejects(
            async () => processCvUpload({ userId, memberId, file: f }),
            (err) => err instanceof BadRequestError && err.message === UPLOAD_RULES.cv.errorMsg,
            "Should reject non-pdf MIME"
        );
    }
    {
        const f = createTempFile("fake content", "bad.pdf", "application/pdf");
        createdFiles.push(f);
        await assert.rejects(
            async () => processCvUpload({ userId, memberId, file: f }),
            (err) => err instanceof BadRequestError && err.message === "Invalid PDF file",
            "Should reject fake PDF content"
        );
    }
    {
        const rules = UPLOAD_RULES.cv;
        const f = createTempFile("x", "large.pdf", "application/pdf");
        f.size = rules.maxBytes + 1;
        createdFiles.push(f);
        await assert.rejects(
            async () => processCvUpload({ userId, memberId, file: f }),
            (err) => err instanceof BadRequestError && err.message === "File too large",
            "Should reject oversize file"
        );
    }

    // Test 3: Avatar validations
    {
        const f = createTempFile("svg content", "test.svg", "image/svg+xml");
        createdFiles.push(f);
        await assert.rejects(
            async () => processAvatarUpload({ userId, memberId, file: f }),
            (err) => err instanceof BadRequestError && err.message === UPLOAD_RULES.avatar.errorMsg,
            "Should reject unsupported avatar MIME"
        );
    }
    {
        const f = createTempFile("imgdata", "test.png", "image/png");
        createdFiles.push(f);
        const res = await processAvatarUpload({ userId, memberId, file: f });
        assert.ok(res.url.endsWith(".png"), "Should return valid URL");
    }

    // Test 4: Image validations
    {
        const f = createTempFile("imgdata", "blog.jpg", "image/jpeg");
        createdFiles.push(f);
        const res = await processImageUpload({ file: f, subDir: "blogs" });
        assert.strictEqual(res.url, "/uploads/blogs/blog.jpg");
    }

    console.log("✅ All upload service tests passed");
    cleanup();
}

if (require.main === module) {
    runTests().catch(e => {
        console.error("❌ Test failed:", e);
        cleanup();
        process.exit(1);
    });
}