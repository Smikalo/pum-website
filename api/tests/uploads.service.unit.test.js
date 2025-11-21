// api/tests/uploads.service.unit.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// --- Mocking dependencies ---
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
    const latest = path.join(__dirname, `../../uploads/cv/${userId}-latest.pdf`);
    try { if (fs.existsSync(latest)) fs.unlinkSync(latest); } catch {}
}

async function runTests() {
    console.log("Running uploads.service.unit.test.js");

    // Test 1
    {
        const p = createTempFile("%PDF-1.4 content", "test.pdf");
        createdFiles.push(p);
        const isPdf = looksLikePdf(p);
        assert.strictEqual(isPdf, true, "Should identify PDF file");
        console.log("✅ looksLikePdf true for PDF content");
    }

    // Test 2
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
        // Fix: Provide mimetype/size so validation passes and we hit content check
        const file = {
            path: p,
            mimetype: 'application/pdf',
            size: 1024,
            originalname: 'test.pdf'
        };

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
        const file = {
            path: p,
            mimetype: 'application/pdf',
            size: 1024,
            originalname: 'good.pdf'
        };

        const result = await processCvUpload({ userId, memberId, file });
        assert(result.url.includes(`${userId}-latest.pdf`), "URL should contain predictable filename");

        const latestPath = path.join(__dirname, `../../uploads/cv/${userId}-latest.pdf`);
        try { if(fs.existsSync(latestPath)) fs.unlinkSync(latestPath); } catch {}

        console.log("✅ processCvUpload succeeds for valid PDF");
    }

    cleanup();
}

// Only run if executed directly (not by Jest)
if (require.main === module) {
    runTests().catch(e => {
        console.error("❌ Test failed:", e);
        cleanup();
        process.exit(1);
    });
}