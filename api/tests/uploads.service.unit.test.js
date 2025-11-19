// api/tests/uploads.service.unit.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// --- Mocking dependencies ---

// 1. Mock db (Prisma) BEFORE requiring the service
const mockPrisma = {
    skill: {
        findMany: async () => []
    },
    tech: {
        findMany: async () => []
    },
    member: {
        findUnique: async () => ({ links: {}, avatarUrl: null }),
        update: async () => {}
    }
};

// Poorman's mock by poisoning the require cache
const dbPath = require.resolve('../src/db');
require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { prisma: mockPrisma }
};

// 2. Import service after mocking
const { processCvUpload, looksLikePdf } = require('../src/services/uploads.service');

// --- Test Setup ---

function createTempFile(content, name) {
    const p = path.join(__dirname, name || `temp-${Date.now()}.tmp`);
    fs.writeFileSync(p, content);
    return p;
}

const userId = "u1";
const memberId = "m1";
let createdFiles = [];

function cleanup() {
    for (const f of createdFiles) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
    createdFiles = [];
    // Also clean up the "latest" CV if created
    const latest = path.join(__dirname, `../uploads/cv/${userId}-latest.pdf`);
    try { if (fs.existsSync(latest)) fs.unlinkSync(latest); } catch {}
}

// --- Tests ---

async function runTests() {
    console.log("Running uploads.service.unit.test.js");

    // Test 1: looksLikePdf returns true for %PDF- header
    {
        const p = createTempFile("%PDF-1.4 content", "test.pdf");
        createdFiles.push(p);
        const isPdf = looksLikePdf(p);
        assert.strictEqual(isPdf, true, "Should identify PDF file");
        console.log("✅ looksLikePdf true for PDF content");
    }

    // Test 2: looksLikePdf returns false for garbage
    {
        const p = createTempFile("NOTPDF content", "fake.pdf");
        createdFiles.push(p);
        const isPdf = looksLikePdf(p);
        assert.strictEqual(isPdf, false, "Should reject non-PDF content");
        console.log("✅ looksLikePdf false for non-PDF content");
    }

    // Test 3: processCvUpload throws if not PDF
    {
        const p = createTempFile("fake content", "bad_upload.tmp");
        createdFiles.push(p);
        const file = { path: p };

        let caught = null;
        try {
            await processCvUpload({ userId, memberId, file });
        } catch (e) {
            caught = e;
        }
        assert(caught, "Should throw error");
        assert.strictEqual(caught.message, "Invalid PDF file");
        console.log("✅ processCvUpload throws on invalid PDF");
    }

    // Test 4: processCvUpload succeeds for valid PDF
    {
        const p = createTempFile("%PDF-1.5 minimal pdf", "good_upload.tmp");
        createdFiles.push(p);
        const file = { path: p };

        const result = await processCvUpload({ userId, memberId, file });
        assert(result.url.includes(`${userId}-latest.pdf`), "URL should contain predictable filename");

        // Verify file moved. NOTE: uploads directory is at ../uploads relative to tests dir.
        const latestPath = path.join(__dirname, `../uploads/cv/${userId}-latest.pdf`);
        assert(fs.existsSync(latestPath), `File should maintain persistence at specific path: ${latestPath}`);

        // Clean up specific file
        fs.unlinkSync(latestPath);
        console.log("✅ processCvUpload succeeds for valid PDF");
    }

    cleanup();
}

runTests().catch(e => {
    console.error("❌ Test failed:", e);
    cleanup();
    process.exit(1);
});